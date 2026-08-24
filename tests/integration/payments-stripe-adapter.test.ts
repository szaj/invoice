import { randomBytes } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { computeConvertedSettlementAmount, toProviderAmountInteger } from "@/domain/money";
import {
  PROVIDER_CREDENTIALS_MISSING,
  PROVIDER_METHOD_DISABLED,
} from "@/domain/payments/providers/errors";
import { resolvePaymentProvider } from "@/domain/payments/providers/registry";
import {
  getCompanyGatewayConfiguration,
  replaceGatewayMethodCredentials,
  toPaymentProviderGatewayConfig,
  updateGatewayMethodConfiguration,
} from "@/server/gateway-config/gateway-config-service";
import { PrismaGatewayConfigStore } from "@/server/gateway-config/gateway-config-repository";
import { GatewayCredentialService } from "@/server/gateway-credentials/gateway-credential-service";
import { createGatewayCredentialResolver } from "@/server/gateway-credentials/resolve-gateway-credentials";
import { createPaymentProviderRegistry } from "@/server/payments/providers/create-payment-provider-registry";
import type {
  StripeApiClient,
  StripeCheckoutSession,
} from "@/server/payments/providers/stripe/stripe-client";
import { StripePaymentAdapter } from "@/server/payments/providers/stripe/stripe-payment-adapter";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

function testKek(): string {
  return randomBytes(32).toString("base64");
}

describe.skipIf(!runDbIntegration)("Stripe adapter integration (TASK-052)", () => {
  const createdCompanyIds: string[] = [];
  const kek = testKek();
  const credentialService = GatewayCredentialService.fromEnv({
    GATEWAY_CREDENTIALS_KEY_VERSION: "1",
    GATEWAY_CREDENTIALS_KEY_V1: kek,
  });
  const store = new PrismaGatewayConfigStore();
  const deps = { store, credentialService };

  afterAll(async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdCompanyIds.length > 0) {
      await prisma.paymentGatewayConfig.deleteMany({
        where: { companyId: { in: createdCompanyIds } },
      });
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
  });

  it("createPaymentRequest uses Admin converted settlement and company-isolated credentials", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const admin: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee51",
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    const companyA = await prisma.company.create({
      data: { displayName: `Stripe Adapter A ${Date.now()}`, status: "ACTIVE" },
    });
    const companyB = await prisma.company.create({
      data: { displayName: `Stripe Adapter B ${Date.now()}`, status: "ACTIVE" },
    });
    createdCompanyIds.push(companyA.id, companyB.id);

    const secretA = "sk_test_integration_company_a_secret";
    const secretB = "sk_test_integration_company_b_secret";

    for (const [companyId, secret] of [
      [companyA.id, secretA],
      [companyB.id, secretB],
    ] as const) {
      const enabled = await updateGatewayMethodConfiguration(
        admin,
        companyId,
        "STRIPE",
        { methodEnabled: true, environment: "SANDBOX" },
        deps,
      );
      expect(enabled.ok).toBe(true);
      const creds = await replaceGatewayMethodCredentials(
        admin,
        companyId,
        "STRIPE",
        {
          credentials: {
            apiSecret: secret,
            webhookSecret: `whsec_${companyId.slice(0, 8)}`,
          },
        },
        deps,
      );
      expect(creds.ok).toBe(true);
    }

    const view = await getCompanyGatewayConfiguration(admin, companyA.id, deps);
    expect(view.ok).toBe(true);
    if (view.ok) {
      const stripe = view.data.methods.find((method) => method.methodCode === "STRIPE");
      expect(stripe?.providerRegistered).toBe(true);
      expect(stripe?.status).toBe("HEALTHY");
      expect(JSON.stringify(view.data)).not.toContain(secretA);
    }

    const providerConfig = await toPaymentProviderGatewayConfig(companyA.id, "STRIPE", deps);
    expect(providerConfig?.credentialsConfigured).toBe(true);
    expect(providerConfig?.environment).toBe("SANDBOX");
    expect(JSON.stringify(providerConfig)).not.toContain(secretA);

    const registry = createPaymentProviderRegistry();
    const resolved = resolvePaymentProvider(registry, providerConfig);
    expect(resolved).toBeInstanceOf(StripePaymentAdapter);

    expect(() =>
      resolvePaymentProvider(registry, {
        ...providerConfig!,
        enabled: false,
      }),
    ).toThrow(PROVIDER_METHOD_DISABLED);

    const createCalls: Array<{ secretKey: string; unitAmount: number }> = [];
    const fakeFactory = (secretKey: string): StripeApiClient => ({
      checkout: {
        sessions: {
          create: async (params) => {
            createCalls.push({
              secretKey,
              unitAmount: params.line_items[0]!.price_data.unit_amount,
            });
            return {
              id: `cs_${secretKey.slice(-6)}`,
              url: "https://checkout.stripe.test/session",
              status: "open",
              payment_status: "unpaid",
            } satisfies StripeCheckoutSession;
          },
          retrieve: async (id) => ({
            id,
            url: null,
            status: "open",
            payment_status: "unpaid",
          }),
        },
      },
      webhooks: {
        constructEvent: () => ({
          id: "evt",
          type: "checkout.session.completed",
          data: { object: {} },
        }),
      },
    });

    const resolver = createGatewayCredentialResolver({ store, credentialService });
    const adapter = new StripePaymentAdapter({
      credentialResolver: resolver,
      createStripeClient: fakeFactory,
    });

    const converted = computeConvertedSettlementAmount({
      invoiceAmountApplied: "100.00",
      invoiceCurrencyCode: "GBP",
      settlementCurrencyCode: "USD",
      fixedConversionRate: "1.25",
      settlementDecimalPrecision: 2,
    });

    const result = await adapter.createPaymentRequest({
      companyId: companyA.id,
      invoiceId: "22222222-2222-4222-8222-222222222222",
      customerId: "33333333-3333-4333-8333-333333333333",
      invoiceCurrencyCode: "GBP",
      invoiceAmountApplied: "100.00",
      settlementCurrencyCode: "USD",
      settlementDecimalPrecision: 2,
      convertedSettlementAmount: converted.convertedSettlementAmount.amount,
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });

    expect(result.status).toBe("PENDING");
    expect(result.checkoutUrl).toContain("checkout.stripe.test");
    expect(JSON.stringify(result)).not.toContain(secretA);
    expect(createCalls[0]?.secretKey).toBe(secretA);
    expect(createCalls[0]?.unitAmount).toBe(
      toProviderAmountInteger(converted.convertedSettlementAmount.amount, 2),
    );
    expect(createCalls[0]?.unitAmount).toBe(12500);
    expect(createCalls[0]?.unitAmount).not.toBe(10000);

    await adapter.createPaymentRequest({
      companyId: companyB.id,
      invoiceId: "22222222-2222-4222-8222-222222222222",
      customerId: "33333333-3333-4333-8333-333333333333",
      invoiceCurrencyCode: "GBP",
      invoiceAmountApplied: "100.00",
      settlementCurrencyCode: "USD",
      settlementDecimalPrecision: 2,
      convertedSettlementAmount: converted.convertedSettlementAmount.amount,
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });
    expect(createCalls[1]?.secretKey).toBe(secretB);
    expect(createCalls[1]?.secretKey).not.toBe(secretA);

    await updateGatewayMethodConfiguration(
      admin,
      companyA.id,
      "STRIPE",
      { methodEnabled: false },
      deps,
    );
    await expect(
      adapter.createPaymentRequest({
        companyId: companyA.id,
        invoiceId: "22222222-2222-4222-8222-222222222222",
        customerId: "33333333-3333-4333-8333-333333333333",
        invoiceCurrencyCode: "GBP",
        invoiceAmountApplied: "100.00",
        settlementCurrencyCode: "USD",
        settlementDecimalPrecision: 2,
        convertedSettlementAmount: "125.00",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      }),
    ).rejects.toThrow(PROVIDER_METHOD_DISABLED);

    const companyC = await prisma.company.create({
      data: { displayName: `Stripe Adapter C ${Date.now()}`, status: "ACTIVE" },
    });
    createdCompanyIds.push(companyC.id);
    await updateGatewayMethodConfiguration(
      admin,
      companyC.id,
      "STRIPE",
      { methodEnabled: true, environment: "SANDBOX" },
      deps,
    );
    await expect(
      adapter.createPaymentRequest({
        companyId: companyC.id,
        invoiceId: "22222222-2222-4222-8222-222222222222",
        customerId: "33333333-3333-4333-8333-333333333333",
        invoiceCurrencyCode: "GBP",
        invoiceAmountApplied: "100.00",
        settlementCurrencyCode: "USD",
        settlementDecimalPrecision: 2,
        convertedSettlementAmount: "125.00",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      }),
    ).rejects.toThrow(PROVIDER_CREDENTIALS_MISSING);
  }, 60_000);
});

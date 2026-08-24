import { randomBytes } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { computeConvertedSettlementAmount, toProviderAmountDecimalString } from "@/domain/money";
import {
  PROVIDER_CREDENTIALS_MISSING,
  PROVIDER_METHOD_DISABLED,
} from "@/domain/payments/providers/errors";
import { resolvePaymentProvider } from "@/domain/payments/providers/registry";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
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
  PayPalApiClient,
  PayPalOrder,
} from "@/server/payments/providers/paypal/paypal-client";
import { PayPalPaymentAdapter } from "@/server/payments/providers/paypal/paypal-payment-adapter";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

function testKek(): string {
  return randomBytes(32).toString("base64");
}

describe.skipIf(!runDbIntegration)("PayPal adapter integration (TASK-054)", () => {
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
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee54",
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    const companyA = await prisma.company.create({
      data: { displayName: `PayPal Adapter A ${Date.now()}`, status: "ACTIVE" },
    });
    const companyB = await prisma.company.create({
      data: { displayName: `PayPal Adapter B ${Date.now()}`, status: "ACTIVE" },
    });
    createdCompanyIds.push(companyA.id, companyB.id);

    const secretA = "paypal_integration_secret_a";
    const secretB = "paypal_integration_secret_b";
    const clientA = "paypal_integration_client_a";
    const clientB = "paypal_integration_client_b";

    for (const [companyId, clientId, secret] of [
      [companyA.id, clientA, secretA],
      [companyB.id, clientB, secretB],
    ] as const) {
      const enabled = await updateGatewayMethodConfiguration(
        admin,
        companyId,
        "PAYPAL",
        { methodEnabled: true, environment: "SANDBOX" },
        deps,
      );
      expect(enabled.ok).toBe(true);
      const creds = await replaceGatewayMethodCredentials(
        admin,
        companyId,
        "PAYPAL",
        { credentials: { apiKey: clientId, apiSecret: secret, webhookSecret: "WH-test" } },
        deps,
      );
      expect(creds.ok).toBe(true);
    }

    const createCalls: Array<{ clientId: string; value: string; currency: string }> = [];
    const fakeFactory = (input: {
      clientId: string;
      clientSecret: string;
      environment: "SANDBOX" | "LIVE";
    }): PayPalApiClient => ({
      orders: {
        create: async (params) => {
          const unit = params.purchase_units[0]!;
          createCalls.push({
            clientId: input.clientId,
            value: unit.amount.value,
            currency: unit.amount.currency_code,
          });
          const order: PayPalOrder = {
            id: `ORDER-${input.clientId}`,
            status: "CREATED",
            links: [
              {
                href: `https://www.sandbox.paypal.com/checkoutnow?token=ORDER-${input.clientId}`,
                rel: "approve",
              },
            ],
          };
          return order;
        },
        retrieve: async (id) => ({ id, status: "CREATED" }),
      },
      webhooks: {
        verifySignature: async () => ({ verificationStatus: "SUCCESS" }),
      },
    });

    const resolver = createGatewayCredentialResolver({ store, credentialService });
    const adapter = new PayPalPaymentAdapter({
      credentialResolver: resolver,
      createPayPalClient: fakeFactory,
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
    expect(result.checkoutUrl).toContain("sandbox.paypal.com");
    expect(JSON.stringify(result)).not.toContain(secretA);
    expect(createCalls[0]?.clientId).toBe(clientA);
    expect(createCalls[0]?.value).toBe(
      toProviderAmountDecimalString(converted.convertedSettlementAmount.amount, 2),
    );
    expect(createCalls[0]?.value).toBe("125.00");
    expect(createCalls[0]?.value).not.toBe("100.00");

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
    expect(createCalls[1]?.clientId).toBe(clientB);
    expect(createCalls[1]?.clientId).not.toBe(clientA);

    await updateGatewayMethodConfiguration(
      admin,
      companyA.id,
      "PAYPAL",
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
      data: { displayName: `PayPal Adapter C ${Date.now()}`, status: "ACTIVE" },
    });
    createdCompanyIds.push(companyC.id);
    await updateGatewayMethodConfiguration(
      admin,
      companyC.id,
      "PAYPAL",
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

    const config = await getCompanyGatewayConfiguration(admin, companyB.id, deps);
    expect(config.ok).toBe(true);
    if (config.ok) {
      const paypal = config.data.methods.find((row) => row.methodCode === "PAYPAL");
      expect(paypal?.providerRegistered).toBe(true);
      const providerConfig = await toPaymentProviderGatewayConfig(companyB.id, "PAYPAL", deps);
      expect(providerConfig).not.toBeNull();
      expect(
        resolvePaymentProvider(createPaymentProviderRegistry(), providerConfig!).methodCode,
      ).toBe("PAYPAL");
    }
  }, 90_000);
});

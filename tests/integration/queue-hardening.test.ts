import { createHmac, randomBytes } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { PaymentProviderRegistry } from "@/domain/payments/providers/registry";
import {
  replaceGatewayMethodCredentials,
  updateGatewayMethodConfiguration,
} from "@/server/gateway-config/gateway-config-service";
import { PrismaGatewayConfigStore } from "@/server/gateway-config/gateway-config-repository";
import { GatewayCredentialService } from "@/server/gateway-credentials/gateway-credential-service";
import { createGatewayCredentialResolver } from "@/server/gateway-credentials/resolve-gateway-credentials";
import { PrismaPaymentEventStore } from "@/server/payments/payment-event-repository";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { StripePaymentAdapter } from "@/server/payments/providers/stripe/stripe-payment-adapter";
import type { StripeApiClient } from "@/server/payments/providers/stripe/stripe-client";
import { processStripeWebhookJob } from "@/server/payments/stripe-webhook-service";
import { createDefaultPaymentServiceDependencies } from "@/server/payments/payment-service";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

async function runWithWorkerRetries<T>(
  handler: () => Promise<T>,
  attempts: number,
): Promise<{ readonly result: T | null; readonly attempts: number; readonly lastError?: string }> {
  let lastError: string | undefined;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await handler();
      return { result, attempts: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "unknown";
    }
  }
  return { result: null, attempts, lastError };
}

describe.skipIf(!runDbIntegration)("queue hardening integration (TASK-099)", () => {
  const createdCompanyIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdInvoiceIds: string[] = [];

  afterAll(async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdPaymentIds.length > 0) {
      await prisma.paymentEvent.deleteMany({ where: { paymentId: { in: createdPaymentIds } } });
      await prisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdInvoiceIds.length > 0) {
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.invoiceVersion.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
    }
    if (createdCustomerIds.length > 0) {
      await prisma.customerCompany.deleteMany({ where: { customerId: { in: createdCustomerIds } } });
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    }
    if (createdCompanyIds.length > 0) {
      await prisma.paymentEvent.deleteMany({ where: { companyId: { in: createdCompanyIds } } });
      await prisma.paymentGatewayConfig.deleteMany({
        where: { companyId: { in: createdCompanyIds } },
      });
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
  });

  it("keeps Stripe webhook idempotent across simulated worker retries", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const kek = randomBytes(32).toString("base64");
    const credentialService = GatewayCredentialService.fromEnv({
      GATEWAY_CREDENTIALS_KEY_VERSION: "1",
      GATEWAY_CREDENTIALS_KEY_V1: kek,
    });
    const store = new PrismaGatewayConfigStore();
    const gatewayDeps = { store, credentialService };

    const admin: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee99",
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    const company = await prisma.company.create({
      data: { displayName: `Queue Hardening ${Date.now()}`, status: "ACTIVE" },
    });
    createdCompanyIds.push(company.id);

    const webhookSecret = `whsec_${randomBytes(8).toString("hex")}`;
    const secretKey = "sk_test_queue_hardening";

    await updateGatewayMethodConfiguration(
      admin,
      company.id,
      "STRIPE",
      { methodEnabled: true, environment: "SANDBOX" },
      gatewayDeps,
    );
    await replaceGatewayMethodCredentials(
      admin,
      company.id,
      "STRIPE",
      { credentials: { apiSecret: secretKey, webhookSecret } },
      gatewayDeps,
    );

    const customer = await prisma.customer.create({
      data: {
        displayName: `Queue Customer ${Date.now()}`,
        status: "ACTIVE",
        customerType: "INDIVIDUAL",
        defaultCompanyId: company.id,
      },
    });
    createdCustomerIds.push(customer.id);
    await prisma.customerCompany.create({ data: { customerId: customer.id, companyId: company.id } });

    const invoice = await prisma.invoice.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        status: "ISSUED",
        currencyCode: "USD",
        invoiceDate: new Date("2026-08-01"),
        dueDate: new Date("2026-08-15"),
        invoiceTotal: "100.00",
        subtotal: "100.00",
        confirmedPaidAmount: "0",
        outstandingAmount: "100.00",
      },
    });
    createdInvoiceIds.push(invoice.id);

    const externalTransactionId = `cs_queue_${randomBytes(4).toString("hex")}`;
    const payment = await prisma.payment.create({
      data: {
        companyId: company.id,
        invoiceId: invoice.id,
        customerId: customer.id,
        methodCode: "STRIPE",
        externalTransactionId,
        status: "PENDING",
        invoiceCurrencyCode: "USD",
        invoiceAmountApplied: "100.00",
        settlementCurrencyCode: "USD",
        fixedConversionRate: "1",
        rateSource: "SAME_CURRENCY",
        rateEffectiveAt: new Date("2026-08-01"),
        convertedSettlementAmount: "100.00",
        paymentDate: new Date("2026-08-01"),
        source: "GATEWAY_API",
      },
    });
    createdPaymentIds.push(payment.id);

    const registry = new PaymentProviderRegistry().register(
      new StripePaymentAdapter({
        credentialResolver: createGatewayCredentialResolver({ store, credentialService }),
        createStripeClient: (): StripeApiClient => ({
          checkout: {
            sessions: {
              create: async () => {
                throw new Error("unused");
              },
              retrieve: async () => {
                throw new Error("unused");
              },
            },
          },
          webhooks: {
            constructEvent: (payload, header, secret) => {
              const expected = createHmac("sha256", secret).update(String(payload)).digest("hex");
              if (String(header) !== expected) {
                const err = new Error("bad sig") as Error & { type: string };
                err.type = "StripeSignatureVerificationError";
                throw err;
              }
              return JSON.parse(String(payload)) as {
                id: string;
                type: string;
                data: { object: Record<string, unknown> };
              };
            },
          },
        }),
      }),
    );

    const events = new PrismaPaymentEventStore();
    const deps = {
      events,
      providerRegistry: registry,
      paymentDeps: {
        ...createDefaultPaymentServiceDependencies(),
        payments: new PrismaPaymentStore(),
      },
    };

    const eventId = `evt_worker_retry_${randomBytes(4).toString("hex")}`;
    const payload = JSON.stringify({
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          id: externalTransactionId,
          payment_status: "paid",
        },
      },
    });
    const headers = { "stripe-signature": sign(payload, webhookSecret) };

    const job = {
      companyId: company.id,
      payload,
      headers,
      correlationId: `corr_${randomBytes(4).toString("hex")}`,
    };

    const firstAttempt = await runWithWorkerRetries(() => processStripeWebhookJob(job, deps), 1);
    expect(firstAttempt.result?.duplicate).toBe(false);
    expect(firstAttempt.result?.outcome).toBe("confirmed");

    const retryAttempt = await runWithWorkerRetries(() => processStripeWebhookJob(job, deps), 3);
    expect(retryAttempt.result?.duplicate).toBe(true);
    expect(retryAttempt.result?.outcome).toBe("duplicate");

    const rows = await prisma.paymentEvent.findMany({
      where: { companyId: company.id, externalEventId: eventId },
    });
    expect(rows).toHaveLength(1);
  });
});

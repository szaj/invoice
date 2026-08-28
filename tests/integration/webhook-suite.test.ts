import { createHmac, randomBytes } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  replaceGatewayMethodCredentials,
  updateGatewayMethodConfiguration,
} from "@/server/gateway-config/gateway-config-service";
import { PrismaGatewayConfigStore } from "@/server/gateway-config/gateway-config-repository";
import { GatewayCredentialService } from "@/server/gateway-credentials/gateway-credential-service";
import { createGatewayCredentialResolver } from "@/server/gateway-credentials/resolve-gateway-credentials";
import { PrismaPaymentEventStore } from "@/server/payments/payment-event-repository";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { PaymentProviderRegistry } from "@/domain/payments/providers/registry";
import { StripePaymentAdapter } from "@/server/payments/providers/stripe/stripe-payment-adapter";
import type { StripeApiClient } from "@/server/payments/providers/stripe/stripe-client";
import { processStripeWebhook } from "@/server/payments/stripe-webhook-service";
import { createDefaultPaymentServiceDependencies } from "@/server/payments/payment-service";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

function testKek(): string {
  return randomBytes(32).toString("base64");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

describe.skipIf(!runDbIntegration)(
  "webhook suite — database integration (TASK-095 / E2E-10)",
  () => {
    const createdCompanyIds: string[] = [];
    const createdPaymentIds: string[] = [];
    const createdCustomerIds: string[] = [];
    const createdInvoiceIds: string[] = [];
    const kek = testKek();
    const credentialService = GatewayCredentialService.fromEnv({
      GATEWAY_CREDENTIALS_KEY_VERSION: "1",
      GATEWAY_CREDENTIALS_KEY_V1: kek,
    });
    const store = new PrismaGatewayConfigStore();
    const gatewayDeps = { store, credentialService };

    afterAll(async () => {
      const { getPrisma } = await import("@/server/db/client");
      const prisma = getPrisma();
      if (createdPaymentIds.length > 0) {
        await prisma.paymentEvent.deleteMany({
          where: { paymentId: { in: createdPaymentIds } },
        });
        await prisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
      }
      if (createdInvoiceIds.length > 0) {
        await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
        await prisma.invoiceVersion.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
        await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
      }
      if (createdCustomerIds.length > 0) {
        await prisma.customerCompany.deleteMany({
          where: { customerId: { in: createdCustomerIds } },
        });
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

    async function seedStripeWebhookFixture() {
      const { getPrisma } = await import("@/server/db/client");
      const prisma = getPrisma();

      const admin: AuthorizationPrincipal = {
        userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee95",
        status: "ACTIVE",
        roleCode: "ADMIN",
      };

      const company = await prisma.company.create({
        data: { displayName: `Webhook Suite ${Date.now()}`, status: "ACTIVE" },
      });
      createdCompanyIds.push(company.id);

      const webhookSecret = `whsec_${randomBytes(8).toString("hex")}`;
      const secretKey = "sk_test_webhook_suite";

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
          displayName: `Webhook Suite Customer ${Date.now()}`,
          status: "ACTIVE",
          customerType: "INDIVIDUAL",
          defaultCompanyId: company.id,
        },
      });
      createdCustomerIds.push(customer.id);
      await prisma.customerCompany.create({
        data: { customerId: customer.id, companyId: company.id },
      });

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

      const externalTransactionId = `cs_suite_${randomBytes(4).toString("hex")}`;
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

      const paymentDeps = {
        ...createDefaultPaymentServiceDependencies(),
        payments: new PrismaPaymentStore(),
      };

      return {
        companyId: company.id,
        paymentId: payment.id,
        externalTransactionId,
        webhookSecret,
        registry,
        paymentDeps,
      };
    }

    it("persists one payment_events row per external event ID on provider retries", async () => {
      const fixture = await seedStripeWebhookFixture();
      const events = new PrismaPaymentEventStore();
      const deps = {
        events,
        providerRegistry: fixture.registry,
        paymentDeps: fixture.paymentDeps,
      };

      const eventId = `evt_retry_${randomBytes(4).toString("hex")}`;
      const payload = JSON.stringify({
        id: eventId,
        type: "checkout.session.completed",
        data: {
          object: { id: fixture.externalTransactionId, payment_status: "paid", status: "complete" },
        },
      });
      const headers = { "stripe-signature": sign(payload, fixture.webhookSecret) };

      const first = await processStripeWebhook(fixture.companyId, payload, headers, deps);
      const retry = await processStripeWebhook(fixture.companyId, payload, headers, deps);

      expect(first.ok).toBe(true);
      expect(retry.ok).toBe(true);
      if (retry.ok) {
        expect(retry.data.duplicate).toBe(true);
      }

      const { getPrisma } = await import("@/server/db/client");
      const prisma = getPrisma();
      const paymentCount = await prisma.payment.count({
        where: { companyId: fixture.companyId, methodCode: "STRIPE" },
      });
      const eventCount = await prisma.paymentEvent.count({
        where: { methodCode: "STRIPE", externalEventId: eventId },
      });
      const payment = await prisma.payment.findUnique({ where: { id: fixture.paymentId } });

      expect(paymentCount).toBe(1);
      expect(eventCount).toBe(1);
      expect(payment?.status).toBe("SUCCESSFUL");
    }, 90_000);

    it("keeps payment SUCCESSFUL when a later FAILED event arrives out of order", async () => {
      const fixture = await seedStripeWebhookFixture();
      const events = new PrismaPaymentEventStore();
      const deps = {
        events,
        providerRegistry: fixture.registry,
        paymentDeps: fixture.paymentDeps,
      };

      const successPayload = JSON.stringify({
        id: `evt_success_${randomBytes(4).toString("hex")}`,
        type: "checkout.session.completed",
        data: {
          object: { id: fixture.externalTransactionId, payment_status: "paid", status: "complete" },
        },
      });
      await processStripeWebhook(
        fixture.companyId,
        successPayload,
        {
          "stripe-signature": sign(successPayload, fixture.webhookSecret),
        },
        deps,
      );

      const failedPayload = JSON.stringify({
        id: `evt_failed_${randomBytes(4).toString("hex")}`,
        type: "checkout.session.expired",
        data: {
          object: {
            id: fixture.externalTransactionId,
            payment_status: "unpaid",
            status: "expired",
          },
        },
      });
      const failed = await processStripeWebhook(
        fixture.companyId,
        failedPayload,
        {
          "stripe-signature": sign(failedPayload, fixture.webhookSecret),
        },
        deps,
      );

      expect(failed.ok).toBe(true);
      if (failed.ok) {
        expect(failed.data.outcome).toBe("already_terminal");
      }

      const { getPrisma } = await import("@/server/db/client");
      const prisma = getPrisma();
      const paymentCount = await prisma.payment.count({
        where: { companyId: fixture.companyId, methodCode: "STRIPE" },
      });
      const payment = await prisma.payment.findUnique({ where: { id: fixture.paymentId } });

      expect(paymentCount).toBe(1);
      expect(payment?.status).toBe("SUCCESSFUL");
    }, 90_000);
  },
);

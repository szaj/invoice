import { createHmac, randomBytes } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { AuditActions } from "@/domain/audit/types";
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

describe.skipIf(!runDbIntegration)("Stripe webhook integration (TASK-053 / E2E-10)", () => {
  const createdCompanyIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdAuditIds: string[] = [];
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
    if (createdAuditIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { id: { in: createdAuditIds } } });
    }
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

  it("records payment_events migration, rejects unsigned, confirms once on duplicate", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();

    const migration = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name = '20260824280000_payment_events'
    `;
    expect(migration).toHaveLength(1);

    const admin: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee53",
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    const company = await prisma.company.create({
      data: { displayName: `Stripe Webhook ${Date.now()}`, status: "ACTIVE" },
    });
    createdCompanyIds.push(company.id);

    const webhookSecret = `whsec_${randomBytes(8).toString("hex")}`;
    const secretKey = "sk_test_integration_webhook_company";

    expect(
      (
        await updateGatewayMethodConfiguration(
          admin,
          company.id,
          "STRIPE",
          { methodEnabled: true, environment: "SANDBOX" },
          gatewayDeps,
        )
      ).ok,
    ).toBe(true);
    expect(
      (
        await replaceGatewayMethodCredentials(
          admin,
          company.id,
          "STRIPE",
          { credentials: { apiSecret: secretKey, webhookSecret } },
          gatewayDeps,
        )
      ).ok,
    ).toBe(true);

    const customer = await prisma.customer.create({
      data: {
        displayName: `Webhook Customer ${Date.now()}`,
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

    const externalTransactionId = `cs_test_${randomBytes(4).toString("hex")}`;
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
        credentialResolver: createGatewayCredentialResolver({
          store,
          credentialService,
        }),
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

    const unsignedPayload = JSON.stringify({
      id: `evt_${randomBytes(4).toString("hex")}`,
      type: "checkout.session.completed",
      data: { object: { id: externalTransactionId, payment_status: "paid" } },
    });
    const unsigned = await processStripeWebhook(
      company.id,
      unsignedPayload,
      {},
      {
        events: new PrismaPaymentEventStore(),
        providerRegistry: registry,
        paymentDeps,
      },
    );
    expect(unsigned.ok).toBe(false);
    if (!unsigned.ok) {
      expect(unsigned.status).toBe(401);
    }

    const eventId = `evt_${randomBytes(6).toString("hex")}`;
    const payload = JSON.stringify({
      id: eventId,
      type: "checkout.session.completed",
      data: { object: { id: externalTransactionId, payment_status: "paid" } },
    });
    const headers = { "stripe-signature": sign(payload, webhookSecret) };

    const first = await processStripeWebhook(company.id, payload, headers, {
      events: new PrismaPaymentEventStore(),
      providerRegistry: registry,
      paymentDeps,
    });
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.data.outcome).toBe("confirmed");
      expect(first.data.paymentId).toBe(payment.id);
      expect(first.data.duplicate).toBe(false);
    }

    const confirmed = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(confirmed?.status).toBe("SUCCESSFUL");

    const second = await processStripeWebhook(company.id, payload, headers, {
      events: new PrismaPaymentEventStore(),
      providerRegistry: registry,
      paymentDeps,
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.data.duplicate).toBe(true);
      expect(second.data.outcome).toBe("duplicate");
    }

    const eventCount = await prisma.paymentEvent.count({
      where: { methodCode: "STRIPE", externalEventId: eventId },
    });
    expect(eventCount).toBe(1);

    const audits = await prisma.auditLog.findMany({
      where: {
        companyId: company.id,
        entityId: payment.id,
        action: AuditActions.PAYMENT_CONFIRMED,
      },
    });
    createdAuditIds.push(...audits.map((audit) => audit.id));
    expect(audits.length).toBeGreaterThanOrEqual(1);
    expect(audits[0]?.actorType).toBe("WEBHOOK");
    const auditJson = JSON.stringify(audits);
    expect(auditJson).not.toContain(webhookSecret);
    expect(auditJson).not.toContain(secretKey);
  }, 90_000);
});

import { createHmac, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { PROVIDER_WEBHOOK_INVALID } from "@/domain/payments/providers/errors";
import type { PaymentRecord } from "@/domain/payments/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";
import { PaymentProviderRegistry } from "@/domain/payments/providers/registry";
import { StripePaymentAdapter } from "@/server/payments/providers/stripe/stripe-payment-adapter";
import type { StripeApiClient } from "@/server/payments/providers/stripe/stripe-client";
import { processStripeWebhook } from "@/server/payments/stripe-webhook-service";
import type { PaymentEventRecord } from "@/domain/payments/events/types";
import type { PrismaPaymentEventStore } from "@/server/payments/payment-event-repository";
import {
  applyGatewayWebhookPaymentStatus,
  type PaymentServiceDependencies,
} from "@/server/payments/payment-service";
import { mapStripeWebhookEvent } from "@/server/payments/providers/stripe/stripe-webhook-map";

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PAYMENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SECRET = "sk_test_webhook_secret_value";
const WEBHOOK_SECRET = "whsec_test_webhook";

function sign(payload: string, secret = WEBHOOK_SECRET): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function checkoutCompletedPayload(eventId: string, sessionId: string): string {
  return JSON.stringify({
    id: eventId,
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        payment_status: "paid",
        status: "complete",
      },
    },
  });
}

function pendingPayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: PAYMENT_ID,
    companyId: COMPANY_ID,
    invoiceId: "22222222-2222-4222-8222-222222222222",
    customerId: "33333333-3333-4333-8333-333333333333",
    methodCode: "STRIPE",
    externalTransactionId: "cs_test_1",
    status: "PENDING",
    complianceStatus: "NOT_REVIEWED",
    invoiceCurrencyCode: "GBP",
    invoiceAmountApplied: "100",
    settlementCurrencyCode: "USD",
    fixedConversionRate: "1.25",
    rateVersionId: "44444444-4444-4444-8444-444444444444",
    rateSource: "ADMIN_FIXED_RATE",
    rateEffectiveAt: new Date("2026-08-01T00:00:00.000Z"),
    convertedSettlementAmount: "125",
    processorFeeAmount: null,
    actualReceivedAmount: null,
    paymentDate: new Date("2026-08-01"),
    receivedAt: null,
    source: "GATEWAY_API",
    notes: null,
    createdByUserId: null,
    confirmedByUserId: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

function memoryEventStore(): PrismaPaymentEventStore & {
  rows: PaymentEventRecord[];
} {
  const rows: PaymentEventRecord[] = [];
  const store = {
    rows,
    async findByExternalEventId(methodCode: PaymentMethodCode, externalEventId: string) {
      return (
        rows.find(
          (row) => row.methodCode === methodCode && row.externalEventId === externalEventId,
        ) ?? null
      );
    },
    async tryCreate(input: {
      companyId: string;
      methodCode: PaymentMethodCode;
      paymentId?: string | null;
      externalEventId: string;
      externalTransactionId?: string | null;
      normalizedStatus?: PaymentEventRecord["normalizedStatus"];
      processorFeeAmount?: string | null;
      processingStatus?: PaymentEventRecord["processingStatus"];
      correlationId: string;
      errorMessage?: string | null;
      processedAt?: Date | null;
    }) {
      if (
        rows.some(
          (row) =>
            row.methodCode === input.methodCode && row.externalEventId === input.externalEventId,
        )
      ) {
        return null;
      }
      const row: PaymentEventRecord = {
        id: randomUUID(),
        companyId: input.companyId,
        methodCode: input.methodCode,
        paymentId: input.paymentId ?? null,
        externalEventId: input.externalEventId,
        externalTransactionId: input.externalTransactionId ?? null,
        normalizedStatus: input.normalizedStatus ?? null,
        processorFeeAmount: input.processorFeeAmount ?? null,
        processingStatus: input.processingStatus ?? "RECEIVED",
        correlationId: input.correlationId,
        errorMessage: input.errorMessage ?? null,
        processedAt: input.processedAt ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rows.push(row);
      return row;
    },
    async update(
      id: string,
      patch: {
        paymentId?: string | null;
        processingStatus?: PaymentEventRecord["processingStatus"];
        errorMessage?: string | null;
        processedAt?: Date | null;
      },
    ) {
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) {
        return null;
      }
      const next = {
        ...rows[index]!,
        ...(patch.paymentId !== undefined ? { paymentId: patch.paymentId } : {}),
        ...(patch.processingStatus !== undefined
          ? { processingStatus: patch.processingStatus }
          : {}),
        ...(patch.errorMessage !== undefined ? { errorMessage: patch.errorMessage } : {}),
        ...(patch.processedAt !== undefined ? { processedAt: patch.processedAt } : {}),
        updatedAt: new Date(),
      };
      rows[index] = next;
      return next;
    },
  };
  return store as unknown as PrismaPaymentEventStore & { rows: PaymentEventRecord[] };
}

function stripeClientFactory(): (secretKey: string) => StripeApiClient {
  return () =>
    ({
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
    }) satisfies StripeApiClient;
}

describe("Stripe webhook mapping (TASK-053)", () => {
  it("maps Checkout Session events to provider-neutral statuses", () => {
    expect(
      mapStripeWebhookEvent({
        id: "evt_paid",
        type: "checkout.session.completed",
        data: { object: { id: "cs_1", payment_status: "paid" } },
      }),
    ).toEqual({
      externalEventId: "evt_paid",
      externalTransactionId: "cs_1",
      status: "SUCCESSFUL",
      processorFeeAmount: null,
    });
    expect(
      mapStripeWebhookEvent({
        id: "evt_exp",
        type: "checkout.session.expired",
        data: { object: { id: "cs_2", payment_status: "unpaid" } },
      }).status,
    ).toBe("FAILED");
  });
});

describe("Stripe webhook processing (TASK-053)", () => {
  it("rejects unsigned webhooks", async () => {
    const events = memoryEventStore();
    const registry = new PaymentProviderRegistry().register(
      new StripePaymentAdapter({
        credentialResolver: {
          async resolveForProvider() {
            return {
              companyId: COMPANY_ID,
              methodCode: "STRIPE",
              enabled: true,
              environment: "SANDBOX",
              credentialsConfigured: true,
              enabledSettlementCurrencyCodes: ["USD"],
              credentials: { apiSecret: SECRET, webhookSecret: WEBHOOK_SECRET },
            };
          },
        },
        createStripeClient: stripeClientFactory(),
      }),
    );

    const payload = checkoutCompletedPayload("evt_unsigned", "cs_test_1");
    const result = await processStripeWebhook(
      COMPANY_ID,
      payload,
      {},
      {
        events,
        providerRegistry: registry,
        paymentDeps: {
          payments: {
            getPaymentById: async () => null,
            getPaymentByExternalTransaction: async () => null,
            listPayments: async () => [],
            createPayment: async () => pendingPayment(),
            updatePaymentLifecycle: async () => null,
          },
        } as unknown as PaymentServiceDependencies,
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe(PROVIDER_WEBHOOK_INVALID);
    }
    expect(events.rows).toHaveLength(0);
  });

  it("confirms a PENDING payment once and ignores duplicate event IDs (E2E-10)", async () => {
    const events = memoryEventStore();
    let payment = pendingPayment();
    const registry = new PaymentProviderRegistry().register(
      new StripePaymentAdapter({
        credentialResolver: {
          async resolveForProvider() {
            return {
              companyId: COMPANY_ID,
              methodCode: "STRIPE",
              enabled: true,
              environment: "SANDBOX",
              credentialsConfigured: true,
              enabledSettlementCurrencyCodes: ["USD"],
              credentials: { apiSecret: SECRET, webhookSecret: WEBHOOK_SECRET },
            };
          },
        },
        createStripeClient: stripeClientFactory(),
      }),
    );

    const paymentDeps = {
      payments: {
        getPaymentById: async (id: string) => (id === payment.id ? payment : null),
        getPaymentByExternalTransaction: async () => payment,
        listPayments: async () => [payment],
        createPayment: async () => payment,
        updatePaymentLifecycle: async (
          id: string,
          expectedStatus: PaymentRecord["status"],
          patch: { status: PaymentRecord["status"]; receivedAt?: Date | null },
        ) => {
          if (id !== payment.id || payment.status !== expectedStatus) {
            return null;
          }
          payment = {
            ...payment,
            status: patch.status,
            receivedAt: patch.receivedAt ?? payment.receivedAt,
            confirmedByUserId: null,
            updatedAt: new Date(),
          };
          return payment;
        },
      },
      invoices: {
        getInvoiceById: async (id: string) =>
          id === payment.invoiceId
            ? {
                id: payment.invoiceId,
                companyId: COMPANY_ID,
                customerId: payment.customerId,
                invoiceNumber: "INV-1",
                invoiceDate: new Date("2026-08-01T00:00:00.000Z"),
                dueDate: new Date("2026-08-31T00:00:00.000Z"),
                currencyCode: "GBP",
                referencePo: null,
                assignedStaffUserId: null,
                status: "ISSUED" as const,
                complianceStatus: "NOT_REVIEWED" as const,
                internalNotes: null,
                customerNotes: null,
                subtotal: "100",
                discountTotal: "0",
                taxTotal: "0",
                invoiceTotal: "100",
                confirmedPaidAmount: "0",
                outstandingAmount: "100",
                cancellationReason: null,
                cancelledAt: null,
                cancelledByUserId: null,
                createdByUserId: null,
                updatedByUserId: null,
                createdAt: new Date("2026-08-01T00:00:00.000Z"),
                updatedAt: new Date("2026-08-01T00:00:00.000Z"),
              }
            : null,
        listInvoices: async () => [],
        updatePaymentAllocation: async (
          _invoiceId: string,
          input: {
            confirmedPaidAmount: string;
            outstandingAmount: string;
            status: "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "DRAFT" | "CANCELLED";
          },
        ) => ({
          id: payment.invoiceId,
          companyId: COMPANY_ID,
          customerId: payment.customerId,
          invoiceNumber: "INV-1",
          invoiceDate: new Date("2026-08-01T00:00:00.000Z"),
          dueDate: new Date("2026-08-31T00:00:00.000Z"),
          currencyCode: "GBP",
          referencePo: null,
          assignedStaffUserId: null,
          status: input.status,
          complianceStatus: "NOT_REVIEWED" as const,
          internalNotes: null,
          customerNotes: null,
          subtotal: "100",
          discountTotal: "0",
          taxTotal: "0",
          invoiceTotal: "100",
          confirmedPaidAmount: input.confirmedPaidAmount,
          outstandingAmount: input.outstandingAmount,
          cancellationReason: null,
          cancelledAt: null,
          cancelledByUserId: null,
          createdByUserId: null,
          updatedByUserId: null,
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          updatedAt: new Date(),
        }),
      },
      customers: { getCustomerById: async () => null },
      settlement: { getCompanySettlementConfiguration: async () => null },
      currencies: {
        findByCode: async (code: string) =>
          code === "GBP" || code === "USD"
            ? {
                id: `curr-${code}`,
                code,
                name: code,
                symbol: code,
                decimalPrecision: 2,
                status: "ACTIVE" as const,
                createdAt: new Date(),
                updatedAt: new Date(),
              }
            : null,
      },
      settings: {
        async getSettings() {
          return {
            id: "system",
            reportingCurrencyCode: "USD",
            defaultTimezone: "UTC",
            roundingTolerance: "0.01",
            invoiceNumberIncludeYear: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        },
      },
      auditWriter: {
        append: async () => ({
          id: randomUUID(),
          actorType: "WEBHOOK" as const,
          actorUserId: null,
          companyId: COMPANY_ID,
          entityType: "payment",
          entityId: PAYMENT_ID,
          action: "payments.confirmed",
          oldValues: null,
          newValues: null,
          reason: null,
          ipAddress: null,
          userAgent: null,
          correlationId: null,
          occurredAt: new Date(),
        }),
      },
    } as unknown as PaymentServiceDependencies;

    const payload = checkoutCompletedPayload("evt_dup", "cs_test_1");
    const headers = { "stripe-signature": sign(payload) };

    const first = await processStripeWebhook(COMPANY_ID, payload, headers, {
      events,
      providerRegistry: registry,
      paymentDeps,
    });
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.data.outcome).toBe("confirmed");
      expect(first.data.paymentId).toBe(PAYMENT_ID);
      expect(first.data.duplicate).toBe(false);
    }
    expect(payment.status).toBe("SUCCESSFUL");
    expect(events.rows).toHaveLength(1);

    const second = await processStripeWebhook(COMPANY_ID, payload, headers, {
      events,
      providerRegistry: registry,
      paymentDeps,
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.data.duplicate).toBe(true);
      expect(second.data.outcome).toBe("duplicate");
    }
    expect(events.rows).toHaveLength(1);
    expect(payment.status).toBe("SUCCESSFUL");
  });

  it("does not create a payment when no PENDING row matches", async () => {
    const events = memoryEventStore();
    const registry = new PaymentProviderRegistry().register(
      new StripePaymentAdapter({
        credentialResolver: {
          async resolveForProvider() {
            return {
              companyId: COMPANY_ID,
              methodCode: "STRIPE",
              enabled: true,
              environment: "SANDBOX",
              credentialsConfigured: true,
              enabledSettlementCurrencyCodes: ["USD"],
              credentials: { apiSecret: SECRET, webhookSecret: WEBHOOK_SECRET },
            };
          },
        },
        createStripeClient: stripeClientFactory(),
      }),
    );

    const payload = checkoutCompletedPayload("evt_orphan", "cs_missing");
    const result = await processStripeWebhook(
      COMPANY_ID,
      payload,
      { "stripe-signature": sign(payload) },
      {
        events,
        providerRegistry: registry,
        paymentDeps: {
          payments: {
            getPaymentById: async () => null,
            getPaymentByExternalTransaction: async () => null,
            listPayments: async () => [],
            createPayment: async () => {
              throw new Error("must not create");
            },
            updatePaymentLifecycle: async () => {
              throw new Error("must not update");
            },
          },
        } as unknown as PaymentServiceDependencies,
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.outcome).toBe("not_found");
      expect(result.data.paymentId).toBeNull();
    }
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0]?.processingStatus).toBe("IGNORED");
  });
});

describe("applyGatewayWebhookPaymentStatus", () => {
  it("is idempotent when payment is already SUCCESSFUL", async () => {
    const payment = pendingPayment({ status: "SUCCESSFUL" });
    const result = await applyGatewayWebhookPaymentStatus(
      {
        companyId: COMPANY_ID,
        methodCode: "STRIPE",
        externalTransactionId: "cs_test_1",
        status: "SUCCESSFUL",
        correlationId: randomUUID(),
      },
      {
        payments: {
          getPaymentById: async () => payment,
          getPaymentByExternalTransaction: async () => payment,
          listPayments: async () => [payment],
          createPayment: async () => payment,
          updatePaymentLifecycle: async () => {
            throw new Error("must not update");
          },
        },
      } as unknown as PaymentServiceDependencies,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.outcome).toBe("already_terminal");
    }
  });
});

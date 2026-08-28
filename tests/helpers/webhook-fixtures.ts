import { createHmac, randomUUID } from "node:crypto";

import type { PaymentEventRecord } from "@/domain/payments/events/types";
import type { PaymentProviderRegistry } from "@/domain/payments/providers/registry";
import type { PaymentRecord } from "@/domain/payments/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";
import { PaymentProviderRegistry as RegistryClass } from "@/domain/payments/providers/registry";
import type { PrismaPaymentEventStore } from "@/server/payments/payment-event-repository";
import type { PaymentServiceDependencies } from "@/server/payments/payment-service";
import type { PayPalApiClient } from "@/server/payments/providers/paypal/paypal-client";
import { PayPalPaymentAdapter } from "@/server/payments/providers/paypal/paypal-payment-adapter";
import type { StripeApiClient } from "@/server/payments/providers/stripe/stripe-client";
import { StripePaymentAdapter } from "@/server/payments/providers/stripe/stripe-payment-adapter";

export const WEBHOOK_COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const WEBHOOK_PAYMENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const WEBHOOK_INVOICE_ID = "22222222-2222-4222-8222-222222222222";
export const WEBHOOK_CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";

export const STRIPE_SECRET = "sk_test_webhook_secret_value";
export const STRIPE_WEBHOOK_SECRET = "whsec_test_webhook";
export const PAYPAL_CLIENT_ID = "paypal_client_webhook";
export const PAYPAL_CLIENT_SECRET = "paypal_secret_webhook";
export const PAYPAL_WEBHOOK_ID = "WH-company-a";

export function stripeSign(payload: string, secret = STRIPE_WEBHOOK_SECRET): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function stripeCheckoutCompletedPayload(eventId: string, sessionId: string): string {
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

export function stripeCheckoutExpiredPayload(eventId: string, sessionId: string): string {
  return JSON.stringify({
    id: eventId,
    type: "checkout.session.expired",
    data: {
      object: {
        id: sessionId,
        payment_status: "unpaid",
        status: "expired",
      },
    },
  });
}

export function paypalVerifiedHeaders(sig = "good"): Record<string, string> {
  return {
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://api.paypal.com/cert",
    "paypal-transmission-id": "tx-1",
    "paypal-transmission-sig": sig,
    "paypal-transmission-time": "2026-08-24T00:00:00Z",
  };
}

export function paypalCaptureCompletedPayload(eventId: string, orderId: string): string {
  return JSON.stringify({
    id: eventId,
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: {
      id: "CAPTURE-1",
      status: "COMPLETED",
      supplementary_data: { related_ids: { order_id: orderId } },
    },
  });
}

export function paypalCaptureDeniedPayload(eventId: string, orderId: string): string {
  return JSON.stringify({
    id: eventId,
    event_type: "PAYMENT.CAPTURE.DENIED",
    resource: {
      id: "CAPTURE-2",
      status: "DENIED",
      supplementary_data: { related_ids: { order_id: orderId } },
    },
  });
}

export function paypalOrderApprovedPayload(eventId: string, orderId: string): string {
  return JSON.stringify({
    id: eventId,
    event_type: "CHECKOUT.ORDER.APPROVED",
    resource: { id: orderId },
  });
}

export function pendingWebhookPayment(
  methodCode: PaymentMethodCode,
  overrides: Partial<PaymentRecord> = {},
): PaymentRecord {
  const externalTransactionId =
    methodCode === "STRIPE" ? "cs_test_1" : methodCode === "PAYPAL" ? "ORDER-1" : "ext-1";

  return {
    id: WEBHOOK_PAYMENT_ID,
    companyId: WEBHOOK_COMPANY_ID,
    invoiceId: WEBHOOK_INVOICE_ID,
    customerId: WEBHOOK_CUSTOMER_ID,
    methodCode,
    externalTransactionId,
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

export function memoryPaymentEventStore(): PrismaPaymentEventStore & {
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

function invoiceRecordForPayment(payment: PaymentRecord) {
  return {
    id: payment.invoiceId,
    companyId: WEBHOOK_COMPANY_ID,
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
  };
}

export type WebhookPaymentHarness = {
  readonly getPayment: () => PaymentRecord;
  readonly setPayment: (next: PaymentRecord) => void;
  readonly deps: PaymentServiceDependencies;
  readonly getCreatePaymentCalls: () => number;
};

/** Mutable payment store for webhook confirm / out-of-order scenarios. */
export function createWebhookPaymentDeps(initial: PaymentRecord): WebhookPaymentHarness {
  let payment = initial;
  let createPaymentCalls = 0;

  const deps = {
    payments: {
      getPaymentById: async (id: string) => (id === payment.id ? payment : null),
      getPaymentByExternalTransaction: async () => payment,
      listPayments: async () => [payment],
      createPayment: async () => {
        createPaymentCalls += 1;
        throw new Error("webhooks must not create payments");
      },
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
        id === payment.invoiceId ? invoiceRecordForPayment(payment) : null,
      listInvoices: async () => [],
      updatePaymentAllocation: async (
        _invoiceId: string,
        input: {
          confirmedPaidAmount: string;
          outstandingAmount: string;
          status: "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "DRAFT" | "CANCELLED";
        },
      ) => ({
        ...invoiceRecordForPayment(payment),
        status: input.status,
        confirmedPaidAmount: input.confirmedPaidAmount,
        outstandingAmount: input.outstandingAmount,
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
        companyId: WEBHOOK_COMPANY_ID,
        entityType: "payment",
        entityId: WEBHOOK_PAYMENT_ID,
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

  return {
    getPayment: () => payment,
    setPayment: (next: PaymentRecord) => {
      payment = next;
    },
    deps,
    getCreatePaymentCalls: () => createPaymentCalls,
  };
}

export function stripeClientFactory(): (secretKey: string) => StripeApiClient {
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

export function paypalClientFactory(): (input: {
  clientId: string;
  clientSecret: string;
  environment: "SANDBOX" | "LIVE";
}) => PayPalApiClient {
  return () => ({
    orders: {
      create: async () => {
        throw new Error("unused");
      },
      retrieve: async () => {
        throw new Error("unused");
      },
    },
    webhooks: {
      verifySignature: async ({ transmissionSig, webhookId }) => {
        if (transmissionSig !== "good" || webhookId !== PAYPAL_WEBHOOK_ID) {
          return { verificationStatus: "FAILURE" };
        }
        return { verificationStatus: "SUCCESS" };
      },
    },
  });
}

export function createStripeWebhookRegistry(): PaymentProviderRegistry {
  return new RegistryClass().register(
    new StripePaymentAdapter({
      credentialResolver: {
        async resolveForProvider() {
          return {
            companyId: WEBHOOK_COMPANY_ID,
            methodCode: "STRIPE",
            enabled: true,
            environment: "SANDBOX",
            credentialsConfigured: true,
            enabledSettlementCurrencyCodes: ["USD"],
            credentials: { apiSecret: STRIPE_SECRET, webhookSecret: STRIPE_WEBHOOK_SECRET },
          };
        },
      },
      createStripeClient: stripeClientFactory(),
    }),
  );
}

export function createPayPalWebhookRegistry(): PaymentProviderRegistry {
  return new RegistryClass().register(
    new PayPalPaymentAdapter({
      credentialResolver: {
        async resolveForProvider() {
          return {
            companyId: WEBHOOK_COMPANY_ID,
            methodCode: "PAYPAL",
            enabled: true,
            environment: "SANDBOX",
            credentialsConfigured: true,
            enabledSettlementCurrencyCodes: ["USD"],
            credentials: {
              apiKey: PAYPAL_CLIENT_ID,
              apiSecret: PAYPAL_CLIENT_SECRET,
              webhookSecret: PAYPAL_WEBHOOK_ID,
            },
          };
        },
      },
      createPayPalClient: paypalClientFactory(),
    }),
  );
}

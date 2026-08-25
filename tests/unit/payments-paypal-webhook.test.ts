import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { PROVIDER_WEBHOOK_INVALID } from "@/domain/payments/providers/errors";
import type { PaymentRecord } from "@/domain/payments/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";
import { PaymentProviderRegistry } from "@/domain/payments/providers/registry";
import type { PaymentEventRecord } from "@/domain/payments/events/types";
import type { PrismaPaymentEventStore } from "@/server/payments/payment-event-repository";
import {
  applyGatewayWebhookPaymentStatus,
  type PaymentServiceDependencies,
} from "@/server/payments/payment-service";
import type { PayPalApiClient } from "@/server/payments/providers/paypal/paypal-client";
import { PayPalPaymentAdapter } from "@/server/payments/providers/paypal/paypal-payment-adapter";
import { mapPayPalWebhookEvent } from "@/server/payments/providers/paypal/paypal-webhook-map";
import { processPayPalWebhook } from "@/server/payments/paypal-webhook-service";

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PAYMENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CLIENT_ID = "paypal_client_webhook";
const CLIENT_SECRET = "paypal_secret_webhook";
const WEBHOOK_ID = "WH-company-a";

function verifiedHeaders(sig = "good"): Record<string, string> {
  return {
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://api.paypal.com/cert",
    "paypal-transmission-id": "tx-1",
    "paypal-transmission-sig": sig,
    "paypal-transmission-time": "2026-08-24T00:00:00Z",
  };
}

function captureCompletedPayload(eventId: string, orderId: string): string {
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

function pendingPayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: PAYMENT_ID,
    companyId: COMPANY_ID,
    invoiceId: "22222222-2222-4222-8222-222222222222",
    customerId: "33333333-3333-4333-8333-333333333333",
    methodCode: "PAYPAL",
    externalTransactionId: "ORDER-1",
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
      externalEventId: string;
      externalTransactionId: string | null;
      normalizedStatus: PaymentRecord["status"] | null;
      processorFeeAmount: string | null;
      processingStatus: PaymentEventRecord["processingStatus"];
      correlationId: string;
    }) {
      if (rows.some((row) => row.externalEventId === input.externalEventId)) {
        return null;
      }
      const created: PaymentEventRecord = {
        id: randomUUID(),
        companyId: input.companyId,
        methodCode: input.methodCode,
        paymentId: null,
        externalEventId: input.externalEventId,
        externalTransactionId: input.externalTransactionId,
        normalizedStatus: input.normalizedStatus,
        processorFeeAmount: input.processorFeeAmount,
        processingStatus: input.processingStatus,
        correlationId: input.correlationId,
        errorMessage: null,
        processedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rows.push(created);
      return created;
    },
    async update(
      id: string,
      patch: Partial<{
        paymentId: string | null;
        processingStatus: PaymentEventRecord["processingStatus"];
        errorMessage: string | null;
        processedAt: Date | null;
      }>,
    ) {
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) {
        return null;
      }
      const current = rows[index]!;
      const updated: PaymentEventRecord = {
        ...current,
        paymentId: patch.paymentId !== undefined ? patch.paymentId : current.paymentId,
        processingStatus:
          patch.processingStatus !== undefined ? patch.processingStatus : current.processingStatus,
        errorMessage: patch.errorMessage !== undefined ? patch.errorMessage : current.errorMessage,
        processedAt: patch.processedAt !== undefined ? patch.processedAt : current.processedAt,
        updatedAt: new Date(),
      };
      rows[index] = updated;
      return updated;
    },
  };
  return store as PrismaPaymentEventStore & { rows: PaymentEventRecord[] };
}

function paypalClientFactory(): (input: {
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
        if (transmissionSig !== "good" || webhookId !== WEBHOOK_ID) {
          return { verificationStatus: "FAILURE" };
        }
        return { verificationStatus: "SUCCESS" };
      },
    },
  });
}

describe("PayPal webhook map (TASK-055)", () => {
  it("maps capture/order lifecycle events and rejects unsupported types", () => {
    expect(
      mapPayPalWebhookEvent({
        id: "WH-1",
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: {
          id: "CAP-1",
          supplementary_data: { related_ids: { order_id: "ORDER-9" } },
        },
      }),
    ).toEqual({
      externalEventId: "WH-1",
      externalTransactionId: "ORDER-9",
      status: "SUCCESSFUL",
      processorFeeAmount: null,
    });

    expect(
      mapPayPalWebhookEvent({
        id: "WH-2",
        event_type: "CHECKOUT.ORDER.APPROVED",
        resource: { id: "ORDER-2" },
      }).status,
    ).toBe("PENDING");

    expect(() =>
      mapPayPalWebhookEvent({
        id: "WH-3",
        event_type: "CUSTOMER.DISPUTE.CREATED",
        resource: { id: "D-1" },
      }),
    ).toThrow();
  });
});

describe("processPayPalWebhook (TASK-055 / E2E-10)", () => {
  it("rejects unsigned webhooks", async () => {
    const events = memoryEventStore();
    const registry = new PaymentProviderRegistry().register(
      new PayPalPaymentAdapter({
        credentialResolver: {
          async resolveForProvider() {
            return {
              companyId: COMPANY_ID,
              methodCode: "PAYPAL",
              enabled: true,
              environment: "SANDBOX",
              credentialsConfigured: true,
              enabledSettlementCurrencyCodes: ["USD"],
              credentials: {
                apiKey: CLIENT_ID,
                apiSecret: CLIENT_SECRET,
                webhookSecret: WEBHOOK_ID,
              },
            };
          },
        },
        createPayPalClient: paypalClientFactory(),
      }),
    );

    const payload = captureCompletedPayload("evt_unsigned", "ORDER-1");
    const result = await processPayPalWebhook(
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
      new PayPalPaymentAdapter({
        credentialResolver: {
          async resolveForProvider() {
            return {
              companyId: COMPANY_ID,
              methodCode: "PAYPAL",
              enabled: true,
              environment: "SANDBOX",
              credentialsConfigured: true,
              enabledSettlementCurrencyCodes: ["USD"],
              credentials: {
                apiKey: CLIENT_ID,
                apiSecret: CLIENT_SECRET,
                webhookSecret: WEBHOOK_ID,
              },
            };
          },
        },
        createPayPalClient: paypalClientFactory(),
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

    const payload = captureCompletedPayload("evt_dup", "ORDER-1");
    const headers = verifiedHeaders();

    const first = await processPayPalWebhook(COMPANY_ID, payload, headers, {
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

    const second = await processPayPalWebhook(COMPANY_ID, payload, headers, {
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
  });

  it("ignores orphan events without creating payments", async () => {
    const events = memoryEventStore();
    const registry = new PaymentProviderRegistry().register(
      new PayPalPaymentAdapter({
        credentialResolver: {
          async resolveForProvider() {
            return {
              companyId: COMPANY_ID,
              methodCode: "PAYPAL",
              enabled: true,
              environment: "SANDBOX",
              credentialsConfigured: true,
              enabledSettlementCurrencyCodes: ["USD"],
              credentials: {
                apiKey: CLIENT_ID,
                apiSecret: CLIENT_SECRET,
                webhookSecret: WEBHOOK_ID,
              },
            };
          },
        },
        createPayPalClient: paypalClientFactory(),
      }),
    );

    const payload = captureCompletedPayload("evt_orphan", "ORDER-missing");
    const result = await processPayPalWebhook(COMPANY_ID, payload, verifiedHeaders(), {
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
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.outcome).toBe("not_found");
      expect(result.data.paymentId).toBeNull();
    }
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0]?.processingStatus).toBe("IGNORED");
  });
});

describe("applyGatewayWebhookPaymentStatus (PayPal)", () => {
  it("is idempotent when payment is already SUCCESSFUL", async () => {
    const payment = pendingPayment({ status: "SUCCESSFUL" });
    const result = await applyGatewayWebhookPaymentStatus(
      {
        companyId: COMPANY_ID,
        methodCode: "PAYPAL",
        externalTransactionId: "ORDER-1",
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

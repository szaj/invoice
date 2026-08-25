import { describe, expect, it } from "vitest";

import { AuditActions } from "@/domain/audit/types";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import type { RoleCode } from "@/domain/authz/roles";
import type { InvoiceRecord } from "@/domain/invoices/types";
import { computeCbrf } from "@/domain/money";
import {
  paymentRefundLifecycle,
  type PaymentAdjustmentRecord,
} from "@/domain/payments/adjustments";
import { PaymentProviderRegistry } from "@/domain/payments/providers/registry";
import type { PaymentRecord } from "@/domain/payments/types";
import {
  assertCumulativeRefundWithinPaymentCap,
  resolveFullRefundAmounts,
  resolvePartialRefundAmounts,
  resolveRefundSettlementAmount,
  sumProcessedRefundSettlementAmounts,
} from "@/domain/refunds/invariants";
import { fullRefundSchema, partialRefundSchema } from "@/domain/refunds/schema";
import {
  PAYMENT_ADJUST_FORBIDDEN,
  REFUND_ALREADY_PROCESSED,
  REFUND_EXCEEDS_PAYMENT,
  REFUND_INVALID_INPUT,
  REFUND_REQUIRES_SUCCESSFUL_PAYMENT,
} from "@/domain/refunds/types";
import { FakePaymentAdapter } from "@/server/payments/providers/fake-payment-adapter";
import {
  processFullRefund,
  processPartialRefund,
  type RefundServiceDependencies,
} from "@/server/refunds/refund-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const COMPLIANCE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CUSTOMER_ID = "eeeeeeee-eeee-4eee-8eee-000000000001";
const INVOICE_ID = "ffffffff-ffff-4fff-8fff-000000000001";
const PAYMENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-000000000001";

function principal(
  roleCode: RoleCode,
  overrides: Partial<AuthorizationPrincipal> = {},
): AuthorizationPrincipal {
  const userId =
    roleCode === "STAFF" ? STAFF_ID : roleCode === "COMPLIANCE" ? COMPLIANCE_ID : ADMIN_ID;
  return {
    userId,
    status: "ACTIVE",
    roleCode,
    assignedCompanyIds: roleCode === "ADMIN" ? [] : [COMPANY_A],
    ...overrides,
  };
}

function invoiceRecord(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: INVOICE_ID,
    companyId: COMPANY_A,
    customerId: CUSTOMER_ID,
    invoiceNumber: "INV-000001",
    invoiceDate: new Date("2026-01-15T00:00:00.000Z"),
    dueDate: new Date("2026-02-15T00:00:00.000Z"),
    currencyCode: "USD",
    referencePo: null,
    assignedStaffUserId: STAFF_ID,
    status: "PAID",
    complianceStatus: "NOT_REVIEWED",
    internalNotes: null,
    customerNotes: null,
    subtotal: "100",
    discountTotal: "0",
    taxTotal: "0",
    invoiceTotal: "100",
    confirmedPaidAmount: "100",
    outstandingAmount: "0",
    cancellationReason: null,
    cancelledAt: null,
    cancelledByUserId: null,
    createdByUserId: STAFF_ID,
    updatedByUserId: STAFF_ID,
    createdAt: new Date("2026-01-15T00:00:00.000Z"),
    updatedAt: new Date("2026-01-15T00:00:00.000Z"),
    ...overrides,
  };
}

function successfulPayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: PAYMENT_ID,
    companyId: COMPANY_A,
    invoiceId: INVOICE_ID,
    customerId: CUSTOMER_ID,
    methodCode: "MANUAL",
    externalTransactionId: null,
    status: "SUCCESSFUL",
    complianceStatus: "NOT_REVIEWED",
    invoiceCurrencyCode: "USD",
    invoiceAmountApplied: "100",
    settlementCurrencyCode: "AED",
    fixedConversionRate: "3.67",
    rateVersionId: null,
    rateSource: "ADMIN_FIXED_RATE",
    rateEffectiveAt: new Date("2026-01-15T00:00:00.000Z"),
    convertedSettlementAmount: "367",
    processorFeeAmount: "2.50",
    actualReceivedAmount: "364.50",
    paymentDate: new Date("2026-01-15T00:00:00.000Z"),
    receivedAt: new Date("2026-01-15T15:00:00.000Z"),
    source: "MANUAL",
    notes: null,
    createdByUserId: ADMIN_ID,
    confirmedByUserId: ADMIN_ID,
    createdAt: new Date("2026-01-15T15:00:00.000Z"),
    updatedAt: new Date("2026-01-15T15:00:00.000Z"),
    ...overrides,
  };
}

function createDeps(seed: {
  payments?: PaymentRecord[];
  invoices?: InvoiceRecord[];
  adjustments?: PaymentAdjustmentRecord[];
  providerRegistry?: PaymentProviderRegistry;
}): RefundServiceDependencies & {
  auditWriter: ReturnType<typeof createMemoryAuditWriter>;
  createdAdjustments: PaymentAdjustmentRecord[];
} {
  const payments = [...(seed.payments ?? [successfulPayment()])];
  const invoices = [...(seed.invoices ?? [invoiceRecord()])];
  const createdAdjustments: PaymentAdjustmentRecord[] = [...(seed.adjustments ?? [])];
  const auditWriter = createMemoryAuditWriter();
  let nextId = 1;

  return {
    auditWriter,
    createdAdjustments,
    providerRegistry: seed.providerRegistry,
    now: () => new Date("2026-08-25T12:00:00.000Z"),
    enforceTransactionalCompanyScope: async (actor, companyId) => {
      assertCompanyAccess(actor, companyId);
      return { ok: true as const, data: true as const };
    },
    payments: {
      async getPaymentById(id: string) {
        return payments.find((row) => row.id === id) ?? null;
      },
    },
    invoices: {
      async getInvoiceById(id: string) {
        return invoices.find((row) => row.id === id) ?? null;
      },
    },
    adjustments: {
      async createAdjustment(input) {
        const created: PaymentAdjustmentRecord = {
          id: `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`,
          companyId: input.companyId,
          paymentId: input.paymentId,
          type: input.type,
          status: input.status,
          amount: input.amount,
          invoiceAmount: input.invoiceAmount,
          settlementAmount: input.settlementAmount,
          reason: input.reason,
          merchantReference: input.merchantReference,
          notes: input.notes,
          effectiveDate: input.effectiveDate,
          openedAt: input.openedAt,
          processedAt: input.processedAt,
          resolvedAt: input.resolvedAt,
          createdByUserId: input.createdByUserId,
          createdAt: new Date("2026-08-25T12:00:00.000Z"),
          updatedAt: new Date("2026-08-25T12:00:00.000Z"),
        };
        nextId += 1;
        createdAdjustments.push(created);
        return created;
      },
      async listAdjustmentsByPayment(paymentId: string) {
        return createdAdjustments.filter((row) => row.paymentId === paymentId);
      },
    },
  };
}

describe("full refund amount resolution (TASK-064 / BR-025)", () => {
  it("uses merchant actual settlement when provided, else payment snapshot — never today's rate", () => {
    const fromSnapshot = resolveRefundSettlementAmount({
      paymentConvertedSettlementAmount: "367",
      actualSettlementAmount: null,
    });
    expect(fromSnapshot).toBe("367");

    const fromActual = resolveRefundSettlementAmount({
      paymentConvertedSettlementAmount: "367",
      actualSettlementAmount: "365.50",
    });
    expect(fromActual).toBe("365.5");

    const full = resolveFullRefundAmounts({
      payment: successfulPayment(),
      actualSettlementAmount: null,
    });
    expect(full.invoiceAmount).toBe("100");
    expect(full.settlementAmount).toBe("367");
    expect(full.amount).toBe("367");

    // Snapshot stays locked even if a later market rate would be 3.68 → 368.
    expect(full.settlementAmount).not.toBe("368");
  });
});

describe("processFullRefund (TASK-064)", () => {
  it("creates linked REFUND PROCESSED, preserves SUCCESSFUL financial fields, and includes CB/RF", async () => {
    const deps = createDeps({});
    const paymentBefore = { ...successfulPayment() };

    const result = await processFullRefund(
      principal("ADMIN"),
      PAYMENT_ID,
      { reason: "Customer request", merchantReference: "RF-1" },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.data.payment.status).toBe("SUCCESSFUL");
    expect(result.data.payment.invoiceAmountApplied).toBe(paymentBefore.invoiceAmountApplied);
    expect(result.data.payment.convertedSettlementAmount).toBe(
      paymentBefore.convertedSettlementAmount,
    );
    expect(result.data.payment.fixedConversionRate).toBe(paymentBefore.fixedConversionRate);
    expect(result.data.payment.processorFeeAmount).toBe(paymentBefore.processorFeeAmount);
    expect(result.data.adjustment.type).toBe("REFUND");
    expect(result.data.adjustment.status).toBe("PROCESSED");
    expect(result.data.adjustment.invoiceAmount).toBe("100");
    expect(result.data.adjustment.settlementAmount).toBe("367");
    expect(result.data.adjustment.amount).toBe("367");
    expect(result.data.lifecycle).toBe("REFUNDED");
    expect(paymentRefundLifecycle([result.data.adjustment])).toBe("REFUNDED");

    expect(
      computeCbrf({
        adjustments: [result.data.adjustment],
        currencyCode: "AED",
        decimalPrecision: 2,
      }).amount,
    ).toBe("367");

    expect(deps.auditWriter.events.map((event) => event.action)).toEqual([
      AuditActions.PAYMENT_REFUND_PROCESSED,
    ]);
    expect(deps.auditWriter.events[0]?.newValues).toMatchObject({
      paymentStatus: "SUCCESSFUL",
      type: "REFUND",
      status: "PROCESSED",
      lifecycle: "REFUNDED",
      usedMerchantActualSettlement: false,
    });
  });

  it("stores merchant actual settlement when provided instead of recalculating from today's rate", async () => {
    const deps = createDeps({});
    const result = await processFullRefund(
      principal("COMPLIANCE"),
      PAYMENT_ID,
      { actualSettlementAmount: "365.25", effectiveDate: "2026-08-20" },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }
    expect(result.data.adjustment.settlementAmount).toBe("365.25");
    expect(result.data.adjustment.amount).toBe("365.25");
    expect(result.data.payment.convertedSettlementAmount).toBe("367");
    expect(result.data.payment.fixedConversionRate).toBe("3.67");
    expect(
      computeCbrf({
        adjustments: [result.data.adjustment],
        currencyCode: "AED",
        decimalPrecision: 2,
      }).amount,
    ).toBe("365.25");
  });

  it("optionally calls adapter.refundPayment when supported", async () => {
    const fake = new FakePaymentAdapter({
      methodCode: "PAYPAL",
      webhookSecret: "test-secret",
    });
    const created = await fake.createPaymentRequest({
      companyId: COMPANY_A,
      invoiceId: INVOICE_ID,
      customerId: CUSTOMER_ID,
      invoiceCurrencyCode: "USD",
      invoiceAmountApplied: "100",
      settlementCurrencyCode: "AED",
      settlementDecimalPrecision: 2,
      convertedSettlementAmount: "367",
      successUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/cancel",
    });
    const registry = new PaymentProviderRegistry().register(fake);
    const deps = createDeps({
      payments: [
        successfulPayment({
          methodCode: "PAYPAL",
          externalTransactionId: created.externalTransactionId,
          settlementCurrencyCode: "AED",
          convertedSettlementAmount: "367",
        }),
      ],
      providerRegistry: registry,
    });

    const result = await processFullRefund(principal("ADMIN"), PAYMENT_ID, {}, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }
    expect(result.data.providerRefund).not.toBeNull();
    expect(result.data.providerRefund?.amount).toBe("367");
    expect(result.data.providerRefund?.externalRefundId).toContain("fake_rf_");
    expect(result.data.payment.convertedSettlementAmount).toBe("367");
  });

  it("denies Staff and rejects pending / duplicate refund / invalid input", async () => {
    const staff = await processFullRefund(principal("STAFF"), PAYMENT_ID, {}, createDeps({}));
    expect(staff.ok).toBe(false);
    if (!staff.ok) {
      expect(staff.status).toBe(403);
      expect(staff.error).toBe(PAYMENT_ADJUST_FORBIDDEN);
    }

    const pending = await processFullRefund(
      principal("ADMIN"),
      PAYMENT_ID,
      {},
      createDeps({ payments: [successfulPayment({ status: "PENDING" })] }),
    );
    expect(pending.ok).toBe(false);
    if (!pending.ok) {
      expect(pending.status).toBe(400);
      expect(pending.error).toBe(REFUND_REQUIRES_SUCCESSFUL_PAYMENT);
    }

    const existing: PaymentAdjustmentRecord = {
      id: "adj-existing",
      companyId: COMPANY_A,
      paymentId: PAYMENT_ID,
      type: "REFUND",
      status: "PROCESSED",
      amount: "367",
      invoiceAmount: "100",
      settlementAmount: "367",
      reason: null,
      merchantReference: null,
      notes: null,
      effectiveDate: new Date("2026-08-01T00:00:00.000Z"),
      openedAt: null,
      processedAt: new Date("2026-08-01T00:00:00.000Z"),
      resolvedAt: new Date("2026-08-01T00:00:00.000Z"),
      createdByUserId: ADMIN_ID,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    };
    const duplicate = await processFullRefund(
      principal("ADMIN"),
      PAYMENT_ID,
      {},
      createDeps({ adjustments: [existing] }),
    );
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.status).toBe(400);
      expect(duplicate.error).toBe(REFUND_ALREADY_PROCESSED);
    }

    const isolated = await processFullRefund(
      principal("COMPLIANCE", { assignedCompanyIds: [COMPANY_B] }),
      PAYMENT_ID,
      {},
      createDeps({}),
    );
    expect(isolated.ok).toBe(false);
    if (!isolated.ok) {
      expect(isolated.status).toBe(403);
      expect(isolated.error).toBe(PAYMENT_ADJUST_FORBIDDEN);
    }

    const invalid = await processFullRefund(
      principal("ADMIN"),
      PAYMENT_ID,
      { amount: "50", type: "REFUND" },
      createDeps({}),
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.status).toBe(400);
      expect(invalid.error).toBe(REFUND_INVALID_INPUT);
    }

    expect(fullRefundSchema.safeParse({ actualSettlementAmount: 12.5 }).success).toBe(false);
  });
});

describe("partial refund cumulative cap (TASK-065)", () => {
  it("resolves settlement from fixed-rate snapshot and enforces cumulative cap", () => {
    const payment = successfulPayment();
    const amounts = resolvePartialRefundAmounts({
      payment,
      invoiceAmount: "40",
      actualSettlementAmount: null,
    });
    expect(amounts.invoiceAmount).toBe("40");
    expect(amounts.settlementAmount).toBe("146.8"); // 40 × 3.67
    expect(amounts.amount).toBe("146.8");
    // Snapshot rate — never a later market rate of 3.68.
    expect(amounts.settlementAmount).not.toBe("147.2");

    const withActual = resolvePartialRefundAmounts({
      payment,
      invoiceAmount: "40",
      actualSettlementAmount: "145.00",
    });
    expect(withActual.settlementAmount).toBe("145");

    const existing: PaymentAdjustmentRecord = {
      id: "adj-partial-1",
      companyId: COMPANY_A,
      paymentId: PAYMENT_ID,
      type: "REFUND",
      status: "PROCESSED",
      amount: "183.5",
      invoiceAmount: "50",
      settlementAmount: "183.5",
      reason: null,
      merchantReference: null,
      notes: null,
      effectiveDate: new Date("2026-08-01T00:00:00.000Z"),
      openedAt: null,
      processedAt: new Date("2026-08-01T00:00:00.000Z"),
      resolvedAt: new Date("2026-08-01T00:00:00.000Z"),
      createdByUserId: ADMIN_ID,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    };

    expect(sumProcessedRefundSettlementAmounts([existing])).toBe("183.5");

    expect(() =>
      assertCumulativeRefundWithinPaymentCap({
        payment,
        existingAdjustments: [existing],
        proposedInvoiceAmount: "50",
        proposedSettlementAmount: "183.5",
      }),
    ).not.toThrow();

    expect(() =>
      assertCumulativeRefundWithinPaymentCap({
        payment,
        existingAdjustments: [existing],
        proposedInvoiceAmount: "51",
        proposedSettlementAmount: "183.5",
      }),
    ).toThrow(REFUND_EXCEEDS_PAYMENT);

    expect(() =>
      assertCumulativeRefundWithinPaymentCap({
        payment,
        existingAdjustments: [existing],
        proposedInvoiceAmount: "50",
        proposedSettlementAmount: "184",
      }),
    ).toThrow(REFUND_EXCEEDS_PAYMENT);
  });
});

describe("processPartialRefund (TASK-065)", () => {
  it("creates linked REFUND PROCESSED for partial amount, preserves payment, includes CB/RF", async () => {
    const deps = createDeps({});
    const paymentBefore = { ...successfulPayment() };

    const result = await processPartialRefund(
      principal("ADMIN"),
      PAYMENT_ID,
      { invoiceAmount: "40", reason: "Partial", merchantReference: "PRF-1" },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.data.payment.status).toBe("SUCCESSFUL");
    expect(result.data.payment.invoiceAmountApplied).toBe(paymentBefore.invoiceAmountApplied);
    expect(result.data.payment.convertedSettlementAmount).toBe(
      paymentBefore.convertedSettlementAmount,
    );
    expect(result.data.payment.fixedConversionRate).toBe(paymentBefore.fixedConversionRate);
    expect(result.data.adjustment.type).toBe("REFUND");
    expect(result.data.adjustment.status).toBe("PROCESSED");
    expect(result.data.adjustment.invoiceAmount).toBe("40");
    expect(result.data.adjustment.settlementAmount).toBe("146.8");
    expect(result.data.adjustment.amount).toBe("146.8");
    expect(result.data.lifecycle).toBe("REFUNDED");

    expect(
      computeCbrf({
        adjustments: [result.data.adjustment],
        currencyCode: "AED",
        decimalPrecision: 2,
      }).amount,
    ).toBe("146.8");

    expect(deps.auditWriter.events.map((event) => event.action)).toEqual([
      AuditActions.PAYMENT_REFUND_PROCESSED,
    ]);
    expect(deps.auditWriter.events[0]?.newValues).toMatchObject({
      paymentStatus: "SUCCESSFUL",
      type: "REFUND",
      status: "PROCESSED",
      partial: true,
      lifecycle: "REFUNDED",
    });
  });

  it("allows multiple partials up to the cap and rejects over-refund", async () => {
    const deps = createDeps({});

    const first = await processPartialRefund(
      principal("COMPLIANCE"),
      PAYMENT_ID,
      { invoiceAmount: "60" },
      deps,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error(first.error);
    }
    expect(first.data.adjustment.settlementAmount).toBe("220.2");

    const second = await processPartialRefund(
      principal("ADMIN"),
      PAYMENT_ID,
      { invoiceAmount: "40" },
      deps,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) {
      throw new Error(second.error);
    }
    expect(second.data.adjustment.settlementAmount).toBe("146.8");

    expect(
      computeCbrf({
        adjustments: [first.data.adjustment, second.data.adjustment],
        currencyCode: "AED",
        decimalPrecision: 2,
      }).amount,
    ).toBe("367");

    const over = await processPartialRefund(
      principal("ADMIN"),
      PAYMENT_ID,
      { invoiceAmount: "0.01" },
      deps,
    );
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.status).toBe(400);
      expect(over.error).toBe(REFUND_EXCEEDS_PAYMENT);
    }
  });

  it("optionally calls adapter.refundPayment with partial=true when supported", async () => {
    const fake = new FakePaymentAdapter({
      methodCode: "PAYPAL",
      webhookSecret: "test-secret",
    });
    const created = await fake.createPaymentRequest({
      companyId: COMPANY_A,
      invoiceId: INVOICE_ID,
      customerId: CUSTOMER_ID,
      invoiceCurrencyCode: "USD",
      invoiceAmountApplied: "100",
      settlementCurrencyCode: "AED",
      settlementDecimalPrecision: 2,
      convertedSettlementAmount: "367",
      successUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/cancel",
    });
    const registry = new PaymentProviderRegistry().register(fake);
    const deps = createDeps({
      payments: [
        successfulPayment({
          methodCode: "PAYPAL",
          externalTransactionId: created.externalTransactionId,
          settlementCurrencyCode: "AED",
          convertedSettlementAmount: "367",
        }),
      ],
      providerRegistry: registry,
    });

    const result = await processPartialRefund(
      principal("ADMIN"),
      PAYMENT_ID,
      { invoiceAmount: "25" },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }
    expect(result.data.providerRefund).not.toBeNull();
    expect(result.data.providerRefund?.amount).toBe("91.75");
    expect(result.data.payment.convertedSettlementAmount).toBe("367");
  });

  it("denies Staff and rejects pending / invalid input / over-cap merchant actual", async () => {
    const staff = await processPartialRefund(
      principal("STAFF"),
      PAYMENT_ID,
      { invoiceAmount: "10" },
      createDeps({}),
    );
    expect(staff.ok).toBe(false);
    if (!staff.ok) {
      expect(staff.status).toBe(403);
      expect(staff.error).toBe(PAYMENT_ADJUST_FORBIDDEN);
    }

    const pending = await processPartialRefund(
      principal("ADMIN"),
      PAYMENT_ID,
      { invoiceAmount: "10" },
      createDeps({ payments: [successfulPayment({ status: "PENDING" })] }),
    );
    expect(pending.ok).toBe(false);
    if (!pending.ok) {
      expect(pending.status).toBe(400);
      expect(pending.error).toBe(REFUND_REQUIRES_SUCCESSFUL_PAYMENT);
    }

    const invalid = await processPartialRefund(
      principal("ADMIN"),
      PAYMENT_ID,
      { reason: "missing invoiceAmount" },
      createDeps({}),
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.status).toBe(400);
      expect(invalid.error).toBe(REFUND_INVALID_INPUT);
    }

    expect(partialRefundSchema.safeParse({ invoiceAmount: 12.5 }).success).toBe(false);

    const overActual = await processPartialRefund(
      principal("ADMIN"),
      PAYMENT_ID,
      { invoiceAmount: "10", actualSettlementAmount: "400" },
      createDeps({}),
    );
    expect(overActual.ok).toBe(false);
    if (!overActual.ok) {
      expect(overActual.status).toBe(400);
      expect(overActual.error).toBe(REFUND_EXCEEDS_PAYMENT);
    }
  });
});

import { describe, expect, it } from "vitest";

import { AuditActions } from "@/domain/audit/types";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import type { RoleCode } from "@/domain/authz/roles";
import type { InvoiceRecord } from "@/domain/invoices/types";
import { computeCbrf } from "@/domain/money";
import {
  ADJUSTMENT_ALREADY_CANCELLED,
  ADJUSTMENT_NOTE_INVALID_INPUT,
  ADJUSTMENT_NOTE_REQUIRES_SUCCESSFUL_PAYMENT,
  ADJUSTMENT_NOT_FOUND,
  PAYMENT_ADJUST_FORBIDDEN,
} from "@/domain/payments/adjustment-history";
import { adjustmentNoteCreateSchema } from "@/domain/payments/adjustment-note-schema";
import {
  isCancelledAdjustment,
  isIncludedInFinancialTotals,
  type PaymentAdjustmentRecord,
} from "@/domain/payments/adjustments";
import type { PaymentRecord } from "@/domain/payments/types";
import {
  addPaymentAdjustmentNote,
  cancelPaymentAdjustment,
  listPaymentAdjustments,
  type AdjustmentHistoryServiceDependencies,
} from "@/server/payments/adjustment-history-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const COMPLIANCE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CUSTOMER_ID = "eeeeeeee-eeee-4eee-8eee-000000000001";
const INVOICE_ID = "ffffffff-ffff-4fff-8fff-000000000001";
const PAYMENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-000000000001";
const REFUND_ID = "00000000-0000-4000-8000-000000000068";

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
    settlementCurrencyCode: "USD",
    fixedConversionRate: "1",
    rateVersionId: null,
    rateSource: "SAME_CURRENCY",
    rateEffectiveAt: new Date("2026-01-15T00:00:00.000Z"),
    convertedSettlementAmount: "100",
    processorFeeAmount: null,
    actualReceivedAmount: null,
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

function refundAdjustment(
  overrides: Partial<PaymentAdjustmentRecord> = {},
): PaymentAdjustmentRecord {
  return {
    id: REFUND_ID,
    companyId: COMPANY_A,
    paymentId: PAYMENT_ID,
    type: "REFUND",
    status: "PROCESSED",
    amount: "40",
    invoiceAmount: "40",
    settlementAmount: "40",
    reason: "customer_request",
    merchantReference: "RF-68",
    notes: "Partial refund",
    effectiveDate: new Date("2026-08-20T00:00:00.000Z"),
    openedAt: null,
    processedAt: new Date("2026-08-20T12:00:00.000Z"),
    resolvedAt: null,
    createdByUserId: ADMIN_ID,
    createdAt: new Date("2026-08-20T12:00:00.000Z"),
    updatedAt: new Date("2026-08-20T12:00:00.000Z"),
    ...overrides,
  };
}

function createDeps(seed: {
  payments?: PaymentRecord[];
  invoices?: InvoiceRecord[];
  adjustments?: PaymentAdjustmentRecord[];
}): AdjustmentHistoryServiceDependencies & {
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
    now: () => new Date("2026-08-25T14:00:00.000Z"),
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
          createdAt: new Date("2026-08-25T14:00:00.000Z"),
          updatedAt: new Date("2026-08-25T14:00:00.000Z"),
        };
        nextId += 1;
        createdAdjustments.push(created);
        return created;
      },
      async getAdjustmentById(adjustmentId: string) {
        return createdAdjustments.find((row) => row.id === adjustmentId) ?? null;
      },
      async listAdjustmentsByPayment(paymentId: string) {
        return createdAdjustments.filter((row) => row.paymentId === paymentId);
      },
      async cancelAdjustment(input) {
        const idx = createdAdjustments.findIndex((row) => row.id === input.adjustmentId);
        if (idx < 0) {
          throw new Error("missing adjustment");
        }
        const current = createdAdjustments[idx]!;
        const cancelled: PaymentAdjustmentRecord = {
          ...current,
          status: "CANCELLED",
          resolvedAt: input.resolvedAt,
          updatedAt: input.resolvedAt,
        };
        createdAdjustments[idx] = cancelled;
        return cancelled;
      },
    },
  };
}

describe("cancelled adjustments excluded from financial totals (TASK-068)", () => {
  it("excludes CANCELLED refunds/notes from CB/RF and isIncludedInFinancialTotals", () => {
    const active = refundAdjustment();
    const cancelled = refundAdjustment({
      id: "00000000-0000-4000-8000-000000000099",
      status: "CANCELLED",
    });
    const note: PaymentAdjustmentRecord = {
      ...refundAdjustment({
        id: "00000000-0000-4000-8000-000000000098",
        type: "NOTE",
        status: "OPEN",
      }),
      amount: "0",
      invoiceAmount: null,
      settlementAmount: null,
    };

    expect(isIncludedInFinancialTotals(active)).toBe(true);
    expect(isIncludedInFinancialTotals(cancelled)).toBe(false);
    expect(isCancelledAdjustment(cancelled)).toBe(true);
    expect(isIncludedInFinancialTotals(note)).toBe(false);

    const withActive = computeCbrf({
      adjustments: [active, note],
      currencyCode: "USD",
      decimalPrecision: 2,
    });
    expect(withActive.amount).toBe("40");

    const afterCancel = computeCbrf({
      adjustments: [cancelled, note, { type: "NOTE", status: "CANCELLED", amount: "0" }],
      currencyCode: "USD",
      decimalPrecision: 2,
    });
    expect(afterCancel.amount).toBe("0");
  });
});

describe("adjustmentNoteCreateSchema (TASK-068)", () => {
  it("requires notes and accepts reason/merchant reference settings fields", () => {
    expect(adjustmentNoteCreateSchema.safeParse({}).success).toBe(false);
    expect(adjustmentNoteCreateSchema.safeParse({ notes: "   " }).success).toBe(false);

    const parsed = adjustmentNoteCreateSchema.safeParse({
      notes: "Called merchant support",
      reason: "follow_up",
      merchantReference: "CASE-68",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.notes).toBe("Called merchant support");
      expect(parsed.data.reason).toBe("follow_up");
      expect(parsed.data.merchantReference).toBe("CASE-68");
    }
  });
});

describe("listPaymentAdjustments (TASK-068)", () => {
  it("lists history including cancelled for viewers; staff can view without payment.adjust", async () => {
    const deps = createDeps({
      adjustments: [
        refundAdjustment(),
        refundAdjustment({ id: "00000000-0000-4000-8000-000000000067", status: "CANCELLED" }),
      ],
    });

    const result = await listPaymentAdjustments(principal("STAFF"), PAYMENT_ID, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.adjustments).toHaveLength(2);
    expect(result.data.adjustments.some((row) => row.status === "CANCELLED")).toBe(true);
  });

  it("rejects unauthenticated list", async () => {
    const deps = createDeps({});
    const result = await listPaymentAdjustments(null, PAYMENT_ID, deps);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.status).toBe(403);
    expect(result.error).toBe(GENERIC_FORBIDDEN);
  });
});

describe("addPaymentAdjustmentNote (TASK-068)", () => {
  it("creates NOTE OPEN with zero amount and does not rewrite payment or CB/RF", async () => {
    const deps = createDeps({ adjustments: [refundAdjustment()] });
    const before = computeCbrf({
      adjustments: deps.createdAdjustments,
      currencyCode: "USD",
      decimalPrecision: 2,
    });

    const result = await addPaymentAdjustmentNote(
      principal("ADMIN"),
      PAYMENT_ID,
      {
        notes: "Spoke with processor",
        reason: "ops_note",
        merchantReference: "NOTE-1",
      },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.adjustment.type).toBe("NOTE");
    expect(result.data.adjustment.status).toBe("OPEN");
    expect(result.data.adjustment.amount).toBe("0");
    expect(result.data.adjustment.notes).toBe("Spoke with processor");
    expect(result.data.payment.status).toBe("SUCCESSFUL");
    expect(result.data.payment.invoiceAmountApplied).toBe("100");

    const after = computeCbrf({
      adjustments: deps.createdAdjustments,
      currencyCode: "USD",
      decimalPrecision: 2,
    });
    expect(after.amount).toBe(before.amount);

    expect(deps.auditWriter.events).toHaveLength(1);
    expect(deps.auditWriter.events[0]?.action).toBe(AuditActions.PAYMENT_ADJUSTMENT_NOTE_ADDED);
  });

  it("denies Staff and rejects non-successful payments / invalid notes", async () => {
    const deps = createDeps({});
    const staff = await addPaymentAdjustmentNote(
      principal("STAFF"),
      PAYMENT_ID,
      { notes: "nope" },
      deps,
    );
    expect(staff.ok).toBe(false);
    if (!staff.ok) {
      expect(staff.error).toBe(PAYMENT_ADJUST_FORBIDDEN);
    }

    const pendingDeps = createDeps({
      payments: [successfulPayment({ status: "PENDING" })],
    });
    const pending = await addPaymentAdjustmentNote(
      principal("ADMIN"),
      PAYMENT_ID,
      { notes: "too early" },
      pendingDeps,
    );
    expect(pending.ok).toBe(false);
    if (!pending.ok) {
      expect(pending.error).toBe(ADJUSTMENT_NOTE_REQUIRES_SUCCESSFUL_PAYMENT);
    }

    const invalid = await addPaymentAdjustmentNote(principal("ADMIN"), PAYMENT_ID, {}, deps);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error).toBe(ADJUSTMENT_NOTE_INVALID_INPUT);
    }
  });
});

describe("cancelPaymentAdjustment (TASK-068)", () => {
  it("soft-cancels, retains history, excludes from totals, audits cancel", async () => {
    const deps = createDeps({ adjustments: [refundAdjustment()] });
    const before = computeCbrf({
      adjustments: deps.createdAdjustments,
      currencyCode: "USD",
      decimalPrecision: 2,
    });
    expect(before.amount).toBe("40");

    const result = await cancelPaymentAdjustment(
      principal("COMPLIANCE"),
      PAYMENT_ID,
      REFUND_ID,
      { reason: "entered_in_error" },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.adjustment.status).toBe("CANCELLED");
    expect(result.data.adjustment.id).toBe(REFUND_ID);
    expect(result.data.payment.invoiceAmountApplied).toBe("100");
    expect(deps.createdAdjustments).toHaveLength(1);
    expect(isIncludedInFinancialTotals(result.data.adjustment)).toBe(false);

    const after = computeCbrf({
      adjustments: deps.createdAdjustments,
      currencyCode: "USD",
      decimalPrecision: 2,
    });
    expect(after.amount).toBe("0");

    expect(deps.auditWriter.events[0]?.action).toBe(AuditActions.PAYMENT_ADJUSTMENT_CANCELLED);
    expect(deps.auditWriter.events[0]?.reason).toBe("entered_in_error");

    const listed = await listPaymentAdjustments(principal("ADMIN"), PAYMENT_ID, deps);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data.adjustments[0]?.status).toBe("CANCELLED");
    }

    const again = await cancelPaymentAdjustment(
      principal("ADMIN"),
      PAYMENT_ID,
      REFUND_ID,
      {},
      deps,
    );
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error).toBe(ADJUSTMENT_ALREADY_CANCELLED);
    }
  });

  it("denies Staff and returns not found for foreign adjustment ids", async () => {
    const deps = createDeps({ adjustments: [refundAdjustment()] });
    const staff = await cancelPaymentAdjustment(
      principal("STAFF"),
      PAYMENT_ID,
      REFUND_ID,
      {},
      deps,
    );
    expect(staff.ok).toBe(false);
    if (!staff.ok) {
      expect(staff.error).toBe(PAYMENT_ADJUST_FORBIDDEN);
    }

    const missing = await cancelPaymentAdjustment(
      principal("ADMIN"),
      PAYMENT_ID,
      "00000000-0000-4000-8000-000000000001",
      {},
      deps,
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error).toBe(ADJUSTMENT_NOT_FOUND);
    }
  });
});

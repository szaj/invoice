import { describe, expect, it } from "vitest";

import { AuditActions } from "@/domain/audit/types";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import type { RoleCode } from "@/domain/authz/roles";
import type { InvoiceRecord } from "@/domain/invoices/types";
import { cbrfAfterDisputeOpen, outstandingAfterDisputeOpen } from "@/domain/disputes/invariants";
import { disputeOpenSchema } from "@/domain/disputes/schema";
import {
  DISPUTE_INVALID_INPUT,
  DISPUTE_REQUIRES_SUCCESSFUL_PAYMENT,
  PAYMENT_ADJUST_FORBIDDEN,
} from "@/domain/disputes/types";
import {
  paymentDisputeLifecycle,
  type PaymentAdjustmentRecord,
} from "@/domain/payments/adjustments";
import type { PaymentRecord } from "@/domain/payments/types";
import {
  openPaymentDispute,
  type DisputeServiceDependencies,
} from "@/server/disputes/dispute-service";
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
    invoiceDate: new Date("2026-08-01T00:00:00.000Z"),
    dueDate: new Date("2026-08-31T00:00:00.000Z"),
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
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
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
    externalTransactionId: "wire-1",
    status: "SUCCESSFUL",
    complianceStatus: "NOT_REVIEWED",
    invoiceCurrencyCode: "USD",
    invoiceAmountApplied: "100",
    settlementCurrencyCode: "USD",
    fixedConversionRate: "1",
    rateVersionId: null,
    rateSource: "SAME_CURRENCY",
    rateEffectiveAt: new Date("2026-08-24T00:00:00.000Z"),
    convertedSettlementAmount: "100",
    processorFeeAmount: "2.50",
    actualReceivedAmount: "97.50",
    paymentDate: new Date("2026-08-24T00:00:00.000Z"),
    receivedAt: new Date("2026-08-24T15:00:00.000Z"),
    source: "MANUAL",
    notes: null,
    createdByUserId: ADMIN_ID,
    confirmedByUserId: ADMIN_ID,
    createdAt: new Date("2026-08-24T15:00:00.000Z"),
    updatedAt: new Date("2026-08-24T15:00:00.000Z"),
    ...overrides,
  };
}

function createDeps(seed: {
  payments?: PaymentRecord[];
  invoices?: InvoiceRecord[];
}): DisputeServiceDependencies & {
  auditWriter: ReturnType<typeof createMemoryAuditWriter>;
  createdAdjustments: PaymentAdjustmentRecord[];
} {
  const payments = [...(seed.payments ?? [successfulPayment()])];
  const invoices = [...(seed.invoices ?? [invoiceRecord()])];
  const createdAdjustments: PaymentAdjustmentRecord[] = [];
  const auditWriter = createMemoryAuditWriter();
  let nextId = 1;

  return {
    auditWriter,
    createdAdjustments,
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

describe("dispute open domain (TASK-063)", () => {
  it("does not change outstanding or CB/RF when a dispute is opened", () => {
    const payments = [successfulPayment()];
    const outstandingBefore = outstandingAfterDisputeOpen({
      invoiceTotal: "100",
      invoiceCurrencyCode: "USD",
      decimalPrecision: 2,
      payments,
      adjustments: [],
    });
    const dispute: PaymentAdjustmentRecord = {
      id: "adj-1",
      companyId: COMPANY_A,
      paymentId: PAYMENT_ID,
      type: "DISPUTE",
      status: "OPEN",
      amount: "100",
      invoiceAmount: "100",
      settlementAmount: "100",
      reason: "Charge unrecognized",
      merchantReference: "CASE-1",
      notes: null,
      effectiveDate: new Date("2026-08-25T00:00:00.000Z"),
      openedAt: new Date("2026-08-25T12:00:00.000Z"),
      processedAt: null,
      resolvedAt: null,
      createdByUserId: ADMIN_ID,
      createdAt: new Date("2026-08-25T12:00:00.000Z"),
      updatedAt: new Date("2026-08-25T12:00:00.000Z"),
    };
    const outstandingAfter = outstandingAfterDisputeOpen({
      invoiceTotal: "100",
      invoiceCurrencyCode: "USD",
      decimalPrecision: 2,
      payments,
      adjustments: [dispute],
    });
    expect(outstandingAfter).toBe("0");
    expect(outstandingAfter).toBe(outstandingBefore);

    const cbrfBefore = cbrfAfterDisputeOpen([], "USD", 2);
    const cbrfAfter = cbrfAfterDisputeOpen([dispute], "USD", 2);
    expect(cbrfAfter).toBe("0");
    expect(cbrfAfter).toBe(cbrfBefore);
    expect(paymentDisputeLifecycle([dispute])).toBe("DISPUTED");
    expect(paymentDisputeLifecycle([{ type: "DISPUTE", status: "UNDER_REVIEW" }])).toBe(
      "UNDER_REVIEW",
    );
  });

  it("rejects amount, paymentId, and type smuggling on the open-dispute schema", () => {
    const parsed = disputeOpenSchema.safeParse({
      reason: "Cardholder dispute",
      amount: "50.00",
      type: "REFUND",
      paymentId: PAYMENT_ID,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("openPaymentDispute (TASK-063)", () => {
  it("creates a linked OPEN dispute, preserves SUCCESSFUL financial fields, and writes audit", async () => {
    const deps = createDeps({});
    const paymentBefore = { ...successfulPayment() };

    const result = await openPaymentDispute(
      principal("ADMIN"),
      PAYMENT_ID,
      { reason: "Charge unrecognized", merchantReference: "CASE-9" },
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
    expect(result.data.payment.processorFeeAmount).toBe(paymentBefore.processorFeeAmount);
    expect(result.data.payment.actualReceivedAmount).toBe(paymentBefore.actualReceivedAmount);
    expect(result.data.adjustment.type).toBe("DISPUTE");
    expect(result.data.adjustment.status).toBe("OPEN");
    expect(result.data.adjustment.paymentId).toBe(PAYMENT_ID);
    expect(result.data.adjustment.amount).toBe("100");
    expect(result.data.lifecycle).toBe("DISPUTED");

    const outstanding = outstandingAfterDisputeOpen({
      invoiceTotal: "100",
      invoiceCurrencyCode: "USD",
      decimalPrecision: 2,
      payments: [result.data.payment],
      adjustments: [result.data.adjustment],
    });
    expect(outstanding).toBe("0");
    expect(cbrfAfterDisputeOpen([result.data.adjustment], "USD", 2)).toBe("0");

    expect(deps.auditWriter.events.map((event) => event.action)).toEqual([
      AuditActions.PAYMENT_DISPUTE_OPENED,
    ]);
    expect(deps.auditWriter.events[0]?.entityType).toBe("payment_adjustment");
    expect(deps.auditWriter.events[0]?.newValues).toMatchObject({
      paymentStatus: "SUCCESSFUL",
      type: "DISPUTE",
      status: "OPEN",
      lifecycle: "DISPUTED",
    });
  });

  it("allows Compliance UNDER_REVIEW and denies Staff (payment.adjust)", async () => {
    const complianceDeps = createDeps({});
    const compliance = await openPaymentDispute(
      principal("COMPLIANCE"),
      PAYMENT_ID,
      { status: "UNDER_REVIEW", notes: "Reviewing evidence" },
      complianceDeps,
    );
    expect(compliance.ok).toBe(true);
    if (!compliance.ok) {
      throw new Error(compliance.error);
    }
    expect(compliance.data.lifecycle).toBe("UNDER_REVIEW");
    expect(compliance.data.adjustment.status).toBe("UNDER_REVIEW");

    const staffDeps = createDeps({});
    const staff = await openPaymentDispute(principal("STAFF"), PAYMENT_ID, {}, staffDeps);
    expect(staff.ok).toBe(false);
    if (!staff.ok) {
      expect(staff.status).toBe(403);
      expect(staff.error).toBe(PAYMENT_ADJUST_FORBIDDEN);
    }
    expect(staffDeps.createdAdjustments).toHaveLength(0);
  });

  it("rejects pending payments and unassigned company access", async () => {
    const pendingDeps = createDeps({
      payments: [successfulPayment({ status: "PENDING" })],
      invoices: [
        invoiceRecord({ status: "ISSUED", confirmedPaidAmount: "0", outstandingAmount: "100" }),
      ],
    });
    const pending = await openPaymentDispute(principal("ADMIN"), PAYMENT_ID, {}, pendingDeps);
    expect(pending.ok).toBe(false);
    if (!pending.ok) {
      expect(pending.status).toBe(400);
      expect(pending.error).toBe(DISPUTE_REQUIRES_SUCCESSFUL_PAYMENT);
    }

    const isolated = await openPaymentDispute(
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

    const invalid = await openPaymentDispute(
      principal("ADMIN"),
      PAYMENT_ID,
      { amount: 50 },
      createDeps({}),
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.status).toBe(400);
      expect(invalid.error).toBe(DISPUTE_INVALID_INPUT);
    }
  });
});

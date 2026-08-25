import { describe, expect, it } from "vitest";

import { AuditActions } from "@/domain/audit/types";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import type { RoleCode } from "@/domain/authz/roles";
import { resolveChargebackWonReversalAmounts } from "@/domain/chargebacks/invariants";
import { chargebackWonReversalSchema } from "@/domain/chargebacks/schema";
import {
  CHARGEBACK_INVALID_INPUT,
  CHARGEBACK_WON_ALREADY_RECORDED,
  CHARGEBACK_WON_REQUIRES_DEBIT,
  CHARGEBACK_WON_REQUIRES_SUCCESSFUL_PAYMENT,
  PAYMENT_ADJUST_FORBIDDEN,
} from "@/domain/chargebacks/types";
import type { InvoiceRecord } from "@/domain/invoices/types";
import { computeCbrf } from "@/domain/money";
import {
  paymentChargebackLifecycle,
  type PaymentAdjustmentRecord,
} from "@/domain/payments/adjustments";
import type { PaymentRecord } from "@/domain/payments/types";
import {
  recordChargebackWonReversal,
  type ChargebackServiceDependencies,
} from "@/server/chargebacks/chargeback-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const COMPLIANCE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CUSTOMER_ID = "eeeeeeee-eeee-4eee-8eee-000000000001";
const INVOICE_ID = "ffffffff-ffff-4fff-8fff-000000000001";
const PAYMENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-000000000001";
const DEBIT_ID = "00000000-0000-4000-8000-000000000066";

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

function debitAdjustment(
  overrides: Partial<PaymentAdjustmentRecord> = {},
): PaymentAdjustmentRecord {
  return {
    id: DEBIT_ID,
    companyId: COMPANY_A,
    paymentId: PAYMENT_ID,
    type: "CHARGEBACK",
    status: "DEBITED",
    amount: "367",
    invoiceAmount: "100",
    settlementAmount: "367",
    reason: "Cardholder dispute",
    merchantReference: "CB-CASE-66",
    notes: null,
    effectiveDate: new Date("2026-08-20T00:00:00.000Z"),
    openedAt: null,
    processedAt: new Date("2026-08-20T12:00:00.000Z"),
    resolvedAt: new Date("2026-08-20T12:00:00.000Z"),
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
}): ChargebackServiceDependencies & {
  auditWriter: ReturnType<typeof createMemoryAuditWriter>;
  createdAdjustments: PaymentAdjustmentRecord[];
} {
  const payments = [...(seed.payments ?? [successfulPayment()])];
  const invoices = [...(seed.invoices ?? [invoiceRecord()])];
  const createdAdjustments: PaymentAdjustmentRecord[] = [
    ...(seed.adjustments ?? [debitAdjustment()]),
  ];
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

describe("chargeback won/reversal amount resolution (TASK-067 / BR-025)", () => {
  it("defaults from debit settlement and accepts merchant actual — never today's rate", () => {
    const fromDebit = resolveChargebackWonReversalAmounts({
      debitLoss: debitAdjustment(),
      actualSettlementAmount: null,
    });
    expect(fromDebit.invoiceAmount).toBe("100");
    expect(fromDebit.settlementAmount).toBe("367");
    expect(fromDebit.amount).toBe("367");

    const fromActual = resolveChargebackWonReversalAmounts({
      debitLoss: debitAdjustment(),
      actualSettlementAmount: "365.50",
    });
    expect(fromActual.settlementAmount).toBe("365.5");
    expect(fromActual.amount).toBe("365.5");
  });
});

describe("recordChargebackWonReversal (TASK-067)", () => {
  it("creates REVERSAL WON, preserves payment and debit, restores CB/RF net (E2E-16)", async () => {
    const deps = createDeps({});
    const paymentBefore = { ...successfulPayment() };
    const debitBefore = { ...debitAdjustment() };

    const result = await recordChargebackWonReversal(
      principal("ADMIN"),
      PAYMENT_ID,
      {
        reason: "Chargeback won with card network",
        merchantReference: "CB-WON-67",
        effectiveDate: "2026-08-25",
      },
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

    expect(result.data.debitAdjustment.id).toBe(debitBefore.id);
    expect(result.data.debitAdjustment.type).toBe("CHARGEBACK");
    expect(result.data.debitAdjustment.status).toBe("DEBITED");
    expect(result.data.debitAdjustment.amount).toBe(debitBefore.amount);
    expect(result.data.debitAdjustment.settlementAmount).toBe(debitBefore.settlementAmount);

    expect(result.data.adjustment.type).toBe("REVERSAL");
    expect(result.data.adjustment.status).toBe("WON");
    expect(result.data.adjustment.invoiceAmount).toBe("100");
    expect(result.data.adjustment.settlementAmount).toBe("367");
    expect(result.data.adjustment.amount).toBe("367");
    expect(result.data.adjustment.merchantReference).toBe("CB-WON-67");
    expect(result.data.lifecycle).toBe("CHARGEBACK_WON");
    expect(paymentChargebackLifecycle([result.data.debitAdjustment, result.data.adjustment])).toBe(
      "CHARGEBACK_WON",
    );

    expect(
      computeCbrf({
        adjustments: [result.data.debitAdjustment],
        currencyCode: "AED",
        decimalPrecision: 2,
      }).amount,
    ).toBe("367");
    expect(
      computeCbrf({
        adjustments: [result.data.debitAdjustment, result.data.adjustment],
        currencyCode: "AED",
        decimalPrecision: 2,
      }).amount,
    ).toBe("0");

    const persistedDebit = deps.createdAdjustments.find((row) => row.id === DEBIT_ID);
    expect(persistedDebit?.status).toBe("DEBITED");
    expect(persistedDebit?.amount).toBe("367");

    expect(deps.auditWriter.events.map((event) => event.action)).toEqual([
      AuditActions.PAYMENT_CHARGEBACK_WON,
    ]);
    expect(deps.auditWriter.events[0]?.newValues).toMatchObject({
      paymentStatus: "SUCCESSFUL",
      type: "REVERSAL",
      status: "WON",
      lifecycle: "CHARGEBACK_WON",
      debitAdjustmentId: DEBIT_ID,
      usedMerchantActualSettlement: false,
    });
  });

  it("records REVERSED status and stores merchant actual settlement when provided", async () => {
    const deps = createDeps({});
    const result = await recordChargebackWonReversal(
      principal("COMPLIANCE"),
      PAYMENT_ID,
      { status: "REVERSED", actualSettlementAmount: "365.25", merchantReference: "CB-REV-1" },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }
    expect(result.data.adjustment.status).toBe("REVERSED");
    expect(result.data.lifecycle).toBe("CHARGEBACK_REVERSED");
    expect(result.data.adjustment.settlementAmount).toBe("365.25");
    expect(result.data.adjustment.amount).toBe("365.25");
    expect(result.data.debitAdjustment.status).toBe("DEBITED");
    expect(result.data.debitAdjustment.settlementAmount).toBe("367");
    expect(
      computeCbrf({
        adjustments: [result.data.debitAdjustment, result.data.adjustment],
        currencyCode: "AED",
        decimalPrecision: 2,
      }).amount,
    ).toBe("1.75");
  });

  it("denies Staff and rejects pending / missing debit / duplicate / invalid input", async () => {
    const staff = await recordChargebackWonReversal(
      principal("STAFF"),
      PAYMENT_ID,
      {},
      createDeps({}),
    );
    expect(staff.ok).toBe(false);
    if (!staff.ok) {
      expect(staff.status).toBe(403);
      expect(staff.error).toBe(PAYMENT_ADJUST_FORBIDDEN);
    }

    const pending = await recordChargebackWonReversal(
      principal("ADMIN"),
      PAYMENT_ID,
      {},
      createDeps({ payments: [successfulPayment({ status: "PENDING" })] }),
    );
    expect(pending.ok).toBe(false);
    if (!pending.ok) {
      expect(pending.status).toBe(400);
      expect(pending.error).toBe(CHARGEBACK_WON_REQUIRES_SUCCESSFUL_PAYMENT);
    }

    const noDebit = await recordChargebackWonReversal(
      principal("ADMIN"),
      PAYMENT_ID,
      {},
      createDeps({ adjustments: [] }),
    );
    expect(noDebit.ok).toBe(false);
    if (!noDebit.ok) {
      expect(noDebit.status).toBe(400);
      expect(noDebit.error).toBe(CHARGEBACK_WON_REQUIRES_DEBIT);
    }

    const duplicate = await recordChargebackWonReversal(
      principal("ADMIN"),
      PAYMENT_ID,
      {},
      createDeps({
        adjustments: [
          debitAdjustment(),
          {
            ...debitAdjustment(),
            id: "00000000-0000-4000-8000-000000000099",
            type: "REVERSAL",
            status: "WON",
          },
        ],
      }),
    );
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.status).toBe(400);
      expect(duplicate.error).toBe(CHARGEBACK_WON_ALREADY_RECORDED);
    }

    const invalid = await recordChargebackWonReversal(
      principal("ADMIN"),
      PAYMENT_ID,
      { actualSettlementAmount: 365.25 },
      createDeps({}),
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.status).toBe(400);
      expect(invalid.error).toBe(CHARGEBACK_INVALID_INPUT);
    }
  });

  it("rejects unknown fields via schema", () => {
    const parsed = chargebackWonReversalSchema.safeParse({ extra: true });
    expect(parsed.success).toBe(false);
  });
});

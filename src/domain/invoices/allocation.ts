import { moneyDecimal } from "@/domain/money/decimal";
import { computeInvoiceOutstanding } from "@/domain/money/outstanding";
import { sumMoney, roundMoney, toDecimalString } from "@/domain/money";
import type { DecimalInput } from "@/domain/money/types";
import type { InvoiceStatus } from "@/domain/invoices/types";
import { confirmedInvoiceApplicationsFromPayments } from "@/domain/payments/reconciliation";
import type { PaymentRecord } from "@/domain/payments/types";

/**
 * Payment allocation result (TASK-060 / BR-009).
 * Confirmed paid and outstanding are derived from SUCCESSFUL applications only.
 * Settlement amounts and processor fees never enter these formulas (BR-020).
 */
export type InvoicePaymentAllocation = {
  readonly confirmedPaidAmount: string;
  readonly outstandingAmount: string;
  readonly isSettledWithinTolerance: boolean;
  readonly status: InvoiceStatus;
};

/**
 * Derive invoice payment status from confirmed applications (Payments §10.4).
 * - Settled within rounding tolerance → PAID
 * - Confirmed paid > 0 and not settled → PARTIALLY_PAID
 * - No confirmed paid → ISSUED (caller may still apply overdue separately)
 * DRAFT / CANCELLED are never rewritten by allocation.
 */
export function deriveInvoiceStatusFromPayments(input: {
  readonly currentStatus: InvoiceStatus;
  readonly confirmedPaidAmount: DecimalInput;
  readonly isSettledWithinTolerance: boolean;
}): InvoiceStatus {
  if (input.currentStatus === "DRAFT" || input.currentStatus === "CANCELLED") {
    return input.currentStatus;
  }
  if (input.isSettledWithinTolerance) {
    return "PAID";
  }
  if (moneyDecimal(input.confirmedPaidAmount).gt(0)) {
    return "PARTIALLY_PAID";
  }
  return "ISSUED";
}

/**
 * Compute stored paid/outstanding + status from SUCCESSFUL payment applications.
 * Does not invent overpayment allow (US-015). Does not use settlement FX or fees.
 */
export function computeInvoicePaymentAllocation(input: {
  readonly currentStatus: InvoiceStatus;
  readonly invoiceTotal: DecimalInput;
  readonly invoiceCurrencyCode: string;
  readonly decimalPrecision: number;
  readonly payments: readonly Pick<PaymentRecord, "status" | "invoiceAmountApplied">[];
  readonly roundingTolerance?: DecimalInput;
}): InvoicePaymentAllocation {
  const applications = confirmedInvoiceApplicationsFromPayments(input.payments);
  const confirmedPaid = roundMoney(sumMoney(applications), input.decimalPrecision);
  const outstanding = computeInvoiceOutstanding({
    invoiceTotal: input.invoiceTotal,
    invoiceCurrencyCode: input.invoiceCurrencyCode,
    confirmedApplications: applications,
    decimalPrecision: input.decimalPrecision,
    roundingTolerance: input.roundingTolerance,
  });
  const confirmedPaidAmount = toDecimalString(confirmedPaid);
  const status = deriveInvoiceStatusFromPayments({
    currentStatus: input.currentStatus,
    confirmedPaidAmount,
    isSettledWithinTolerance: outstanding.isSettledWithinTolerance,
  });

  return {
    confirmedPaidAmount,
    outstandingAmount: outstanding.amount,
    isSettledWithinTolerance: outstanding.isSettledWithinTolerance,
    status,
  };
}

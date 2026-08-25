import { moneyDecimal } from "@/domain/money/decimal";
import { computeInvoiceOutstanding } from "@/domain/money/outstanding";
import type { DecimalInput } from "@/domain/money/types";
import { confirmedInvoiceApplicationsFromPayments } from "@/domain/payments/reconciliation";
import { PAYMENT_EXCEEDS_OPEN_BALANCE, type PaymentRecord } from "@/domain/payments/types";

/**
 * BR-010: applied amount must not exceed open balance from SUCCESSFUL applications.
 * PENDING/FAILED rows do not reserve balance. Overpayment *allow* remains US-015 — not invented.
 * Processor fee and actual received never affect this check (BR-020).
 */
export function assertPaymentWithinOpenBalance(input: {
  readonly invoiceTotal: DecimalInput;
  readonly invoiceCurrencyCode: string;
  readonly invoiceDecimalPrecision: number;
  readonly invoiceAmountApplied: DecimalInput;
  readonly existingPayments: readonly Pick<PaymentRecord, "status" | "invoiceAmountApplied">[];
  readonly processorFeeAmount?: DecimalInput | null;
  readonly actualReceivedAmount?: DecimalInput | null;
}): void {
  // Deliberately ignore reconciliation fields — they must never change balance.
  void input.processorFeeAmount;
  void input.actualReceivedAmount;

  const applications = confirmedInvoiceApplicationsFromPayments(input.existingPayments);
  const outstanding = computeInvoiceOutstanding({
    invoiceTotal: input.invoiceTotal,
    invoiceCurrencyCode: input.invoiceCurrencyCode,
    confirmedApplications: applications,
    decimalPrecision: input.invoiceDecimalPrecision,
  });

  if (moneyDecimal(input.invoiceAmountApplied).gt(moneyDecimal(outstanding.amount))) {
    throw new Error(PAYMENT_EXCEEDS_OPEN_BALANCE);
  }
}

/** Alias for TASK-050 call sites — same BR-010 guard (TASK-059). */
export const assertManualPaymentWithinOpenBalance = assertPaymentWithinOpenBalance;

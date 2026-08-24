import { moneyDecimal } from "@/domain/money/decimal";
import { computeInvoiceOutstanding } from "@/domain/money/outstanding";
import type { DecimalInput } from "@/domain/money/types";
import { confirmedInvoiceApplicationsFromPayments } from "@/domain/payments/reconciliation";
import { PAYMENT_EXCEEDS_OPEN_BALANCE, type PaymentRecord } from "@/domain/payments/types";

/**
 * BR-010 / Payments §10.6: applied amount must not exceed open balance.
 * Overpayment authorization workflow remains US-015 (TASK-059/060) — not invented here.
 * Processor fee and actual received never affect this check (BR-020).
 */
export function assertManualPaymentWithinOpenBalance(input: {
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

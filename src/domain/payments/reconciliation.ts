import { computeConvertedSettlementAmount } from "@/domain/money/convert";
import { moneyDecimal, toDecimalString } from "@/domain/money/decimal";
import { computeInvoiceOutstanding } from "@/domain/money/outstanding";
import type { DecimalInput } from "@/domain/money/types";
import {
  PAYMENT_FEE_MUST_NOT_AFFECT_BALANCE,
  PAYMENT_FEE_MUST_NOT_AFFECT_SETTLEMENT,
  PAYMENT_INVALID_INPUT,
  type PaymentRecord,
} from "@/domain/payments/types";

/**
 * Optional merchant/processor fee and actual received (TASK-047 / BR-020).
 * Reconciliation data only — never conversion, outstanding, invoice amount, or applied amount.
 */
export type PaymentReconciliationFields = {
  readonly processorFeeAmount: string | null;
  readonly actualReceivedAmount: string | null;
};

function optionalNonNegativeMoney(value: string | null | undefined): string | null {
  if (value == null || value === "") {
    return null;
  }
  const amount = moneyDecimal(value);
  if (amount.lt(0)) {
    throw new Error(PAYMENT_INVALID_INPUT);
  }
  return toDecimalString(amount);
}

/**
 * Persist reconciliation amounts as provided. Never compute
 * actual_received = converted_settlement − processor_fee.
 */
export function normalizePaymentReconciliationFields(input: {
  readonly processorFeeAmount?: string | null;
  readonly actualReceivedAmount?: string | null;
  /** Ignored — actual received is never derived from settlement or fee. */
  readonly convertedSettlementAmount?: DecimalInput | null;
}): PaymentReconciliationFields {
  void input.convertedSettlementAmount;
  return {
    processorFeeAmount: optionalNonNegativeMoney(input.processorFeeAmount),
    actualReceivedAmount: optionalNonNegativeMoney(input.actualReceivedAmount),
  };
}

/**
 * Invoice-currency applications for outstanding (BR-009 / BR-020).
 * Successful payments only; fee, actual received, and converted settlement are excluded.
 */
export function confirmedInvoiceApplicationsFromPayments(
  payments: readonly Pick<PaymentRecord, "status" | "invoiceAmountApplied">[],
): string[] {
  return payments
    .filter((payment) => payment.status === "SUCCESSFUL")
    .map((payment) => payment.invoiceAmountApplied);
}

export function assertFeeDoesNotAffectConvertedSettlement(input: {
  readonly invoiceAmountApplied: DecimalInput;
  readonly invoiceCurrencyCode: string;
  readonly settlementCurrencyCode: string;
  readonly fixedConversionRate: DecimalInput;
  readonly settlementDecimalPrecision: number;
  readonly convertedSettlementAmount: DecimalInput;
  readonly processorFeeAmount?: DecimalInput | null;
}): void {
  const withFee = computeConvertedSettlementAmount({
    invoiceAmountApplied: input.invoiceAmountApplied,
    invoiceCurrencyCode: input.invoiceCurrencyCode,
    settlementCurrencyCode: input.settlementCurrencyCode,
    fixedConversionRate: input.fixedConversionRate,
    settlementDecimalPrecision: input.settlementDecimalPrecision,
    processorFee: input.processorFeeAmount,
  });
  const withoutFee = computeConvertedSettlementAmount({
    invoiceAmountApplied: input.invoiceAmountApplied,
    invoiceCurrencyCode: input.invoiceCurrencyCode,
    settlementCurrencyCode: input.settlementCurrencyCode,
    fixedConversionRate: input.fixedConversionRate,
    settlementDecimalPrecision: input.settlementDecimalPrecision,
    processorFee: null,
  });

  const stored = moneyDecimal(input.convertedSettlementAmount);
  if (
    !moneyDecimal(withFee.convertedSettlementAmount.amount).equals(stored) ||
    !moneyDecimal(withoutFee.convertedSettlementAmount.amount).equals(stored) ||
    !moneyDecimal(withFee.convertedSettlementAmount.amount).equals(
      moneyDecimal(withoutFee.convertedSettlementAmount.amount),
    )
  ) {
    throw new Error(PAYMENT_FEE_MUST_NOT_AFFECT_SETTLEMENT);
  }
}

export function assertFeeDoesNotAffectInvoiceOutstanding(input: {
  readonly invoiceTotal: DecimalInput;
  readonly invoiceCurrencyCode: string;
  readonly confirmedApplications: readonly DecimalInput[];
  readonly decimalPrecision: number;
  readonly processorFeeAmount?: DecimalInput | null;
  readonly actualReceivedAmount?: DecimalInput | null;
}): void {
  const withFee = computeInvoiceOutstanding({
    invoiceTotal: input.invoiceTotal,
    invoiceCurrencyCode: input.invoiceCurrencyCode,
    confirmedApplications: input.confirmedApplications,
    decimalPrecision: input.decimalPrecision,
    processorFee: input.processorFeeAmount,
    actualReceivedAmount: input.actualReceivedAmount,
  });
  const withoutFee = computeInvoiceOutstanding({
    invoiceTotal: input.invoiceTotal,
    invoiceCurrencyCode: input.invoiceCurrencyCode,
    confirmedApplications: input.confirmedApplications,
    decimalPrecision: input.decimalPrecision,
  });

  if (!moneyDecimal(withFee.amount).equals(moneyDecimal(withoutFee.amount))) {
    throw new Error(PAYMENT_FEE_MUST_NOT_AFFECT_BALANCE);
  }
}

export function assertReconciliationExcludedFromFinancialFormulas(input: {
  readonly invoiceAmountApplied: DecimalInput;
  readonly invoiceCurrencyCode: string;
  readonly settlementCurrencyCode: string;
  readonly fixedConversionRate: DecimalInput;
  readonly settlementDecimalPrecision: number;
  readonly convertedSettlementAmount: DecimalInput;
  readonly processorFeeAmount?: DecimalInput | null;
  readonly actualReceivedAmount?: DecimalInput | null;
  readonly invoiceTotal?: DecimalInput | null;
  readonly invoiceDecimalPrecision?: number;
  readonly confirmedApplications?: readonly DecimalInput[];
}): void {
  assertFeeDoesNotAffectConvertedSettlement(input);

  const applications = input.confirmedApplications ?? [input.invoiceAmountApplied];
  const invoiceTotal = input.invoiceTotal ?? input.invoiceAmountApplied;
  const invoicePrecision = input.invoiceDecimalPrecision ?? input.settlementDecimalPrecision;

  assertFeeDoesNotAffectInvoiceOutstanding({
    invoiceTotal,
    invoiceCurrencyCode: input.invoiceCurrencyCode,
    confirmedApplications: applications,
    decimalPrecision: invoicePrecision,
    processorFeeAmount: input.processorFeeAmount,
    actualReceivedAmount: input.actualReceivedAmount,
  });
}

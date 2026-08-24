import { moneyDecimal, toDecimalString } from "@/domain/money";
import { computeConvertedSettlementAmount } from "@/domain/money/convert";
import {
  PAYMENT_CONFIRMED_FINANCIAL_FIELDS,
  PAYMENT_CONFIRMED_IMMUTABLE,
  PAYMENT_FEE_MUST_NOT_AFFECT_SETTLEMENT,
  PAYMENT_HARD_DELETE_FORBIDDEN,
  type PaymentConfirmedFinancialField,
  type PaymentRecord,
  type PaymentStatus,
} from "@/domain/payments/types";

/**
 * Successful payments are financially immutable (BR-004 / BR-005).
 * Pending/Failed may still be updated by later payment-service workflows.
 */
export function isPaymentFinanciallyImmutable(status: PaymentStatus): boolean {
  return status === "SUCCESSFUL";
}

export function assertPaymentFinancialFieldsMutable(status: PaymentStatus): void {
  if (isPaymentFinanciallyImmutable(status)) {
    throw new Error(PAYMENT_CONFIRMED_IMMUTABLE);
  }
}

/** BR-004: no hard-delete of paid/confirmed payments. */
export function assertPaymentHardDeleteAllowed(status: PaymentStatus): void {
  if (status === "SUCCESSFUL") {
    throw new Error(PAYMENT_HARD_DELETE_FORBIDDEN);
  }
}

/**
 * Confirms fee is stored separately and does not change converted settlement (BR-020).
 * Recomputes settlement from applied × rate (fee ignored) and compares to stored value.
 */
export function assertProcessorFeeExcludedFromSettlement(
  payment: Pick<
    PaymentRecord,
    | "invoiceAmountApplied"
    | "invoiceCurrencyCode"
    | "settlementCurrencyCode"
    | "fixedConversionRate"
    | "convertedSettlementAmount"
    | "processorFeeAmount"
  >,
  settlementDecimalPrecision: number,
): void {
  const recomputed = computeConvertedSettlementAmount({
    invoiceAmountApplied: payment.invoiceAmountApplied,
    invoiceCurrencyCode: payment.invoiceCurrencyCode,
    settlementCurrencyCode: payment.settlementCurrencyCode,
    fixedConversionRate: payment.fixedConversionRate,
    settlementDecimalPrecision,
    processorFee: payment.processorFeeAmount,
  });

  const stored = toDecimalString(payment.convertedSettlementAmount);
  const expected = recomputed.convertedSettlementAmount.amount;
  if (moneyDecimal(stored).equals(moneyDecimal(expected)) === false) {
    throw new Error(PAYMENT_FEE_MUST_NOT_AFFECT_SETTLEMENT);
  }

  if (payment.processorFeeAmount != null) {
    const fee = moneyDecimal(payment.processorFeeAmount);
    const withoutFee = computeConvertedSettlementAmount({
      invoiceAmountApplied: payment.invoiceAmountApplied,
      invoiceCurrencyCode: payment.invoiceCurrencyCode,
      settlementCurrencyCode: payment.settlementCurrencyCode,
      fixedConversionRate: payment.fixedConversionRate,
      settlementDecimalPrecision,
      processorFee: null,
    });
    if (
      moneyDecimal(withoutFee.convertedSettlementAmount.amount).equals(moneyDecimal(expected)) ===
      false
    ) {
      throw new Error(PAYMENT_FEE_MUST_NOT_AFFECT_SETTLEMENT);
    }
    // Fee must remain a distinct field — not silently folded into settlement.
    void fee;
  }
}

export function paymentConfirmedFinancialFieldSet(): ReadonlySet<string> {
  return new Set(PAYMENT_CONFIRMED_FINANCIAL_FIELDS);
}

/**
 * BR-005: once SUCCESSFUL, confirmed financial fields must be unchanged.
 * Used when a caller attempts a patch that includes financial keys.
 */
export function assertConfirmedFinancialFieldsUnchanged(
  current: Pick<PaymentRecord, PaymentConfirmedFinancialField | "status">,
  patch: Partial<Pick<PaymentRecord, PaymentConfirmedFinancialField>>,
): void {
  if (!isPaymentFinanciallyImmutable(current.status)) {
    return;
  }
  for (const field of PAYMENT_CONFIRMED_FINANCIAL_FIELDS) {
    if (field in patch && patch[field] !== current[field]) {
      throw new Error(PAYMENT_CONFIRMED_IMMUTABLE);
    }
  }
}

import { moneyDecimal, sumMoney, toDecimalString } from "@/domain/money";
import { computeCbrf } from "@/domain/money/cbrf";
import {
  isChargebackDebitLoss,
  isChargebackWonReversal,
  isProcessedRefund,
  type PaymentAdjustmentRecord,
} from "@/domain/payments/adjustments";
import type { PaymentRecord } from "@/domain/payments/types";
import {
  CHARGEBACK_ALREADY_RECORDED,
  CHARGEBACK_EXCEEDS_PAYMENT,
  CHARGEBACK_REQUIRES_SUCCESSFUL_PAYMENT,
  CHARGEBACK_SETTLEMENT_AMOUNT_INVALID,
  CHARGEBACK_WON_ALREADY_RECORDED,
  CHARGEBACK_WON_REQUIRES_DEBIT,
  CHARGEBACK_WON_REQUIRES_SUCCESSFUL_PAYMENT,
} from "@/domain/chargebacks/types";

/**
 * BR-025: use merchant actual settlement debit when provided; otherwise the original
 * payment's converted settlement (fixed-rate snapshot). Never today's active rate.
 */
export function resolveChargebackSettlementAmount(input: {
  readonly paymentConvertedSettlementAmount: string;
  readonly actualSettlementAmount?: string | null;
}): string {
  const raw =
    input.actualSettlementAmount != null && input.actualSettlementAmount !== ""
      ? input.actualSettlementAmount
      : input.paymentConvertedSettlementAmount;
  const amount = moneyDecimal(raw);
  if (!amount.gt(0)) {
    throw new Error(CHARGEBACK_SETTLEMENT_AMOUNT_INVALID);
  }
  return toDecimalString(amount);
}

export function resolveChargebackDebitLossAmounts(input: {
  readonly payment: Pick<PaymentRecord, "invoiceAmountApplied" | "convertedSettlementAmount">;
  readonly actualSettlementAmount?: string | null;
}): {
  readonly invoiceAmount: string;
  readonly settlementAmount: string;
  readonly amount: string;
} {
  const invoiceAmount = toDecimalString(moneyDecimal(input.payment.invoiceAmountApplied));
  const settlementAmount = resolveChargebackSettlementAmount({
    paymentConvertedSettlementAmount: input.payment.convertedSettlementAmount,
    actualSettlementAmount: input.actualSettlementAmount,
  });
  return {
    invoiceAmount,
    settlementAmount,
    /** CB/RF contribution uses settlement-currency amount (BR-024 / BR-025). */
    amount: settlementAmount,
  };
}

/**
 * Resolve won/reversal amounts from the prior debit/loss row (TASK-067 / E2E-16).
 * Defaults restore the debit's net CB/RF impact. Merchant actual settlement overrides when known (BR-025).
 * Never mutates the debit row.
 */
export function resolveChargebackWonReversalAmounts(input: {
  readonly debitLoss: Pick<
    PaymentAdjustmentRecord,
    "invoiceAmount" | "settlementAmount" | "amount"
  >;
  readonly actualSettlementAmount?: string | null;
}): {
  readonly invoiceAmount: string;
  readonly settlementAmount: string;
  readonly amount: string;
} {
  const invoiceAmount = toDecimalString(moneyDecimal(input.debitLoss.invoiceAmount ?? "0"));
  const debitSettlement = input.debitLoss.settlementAmount ?? input.debitLoss.amount;
  const settlementAmount = resolveChargebackSettlementAmount({
    paymentConvertedSettlementAmount: debitSettlement,
    actualSettlementAmount: input.actualSettlementAmount,
  });
  return {
    invoiceAmount,
    settlementAmount,
    amount: settlementAmount,
  };
}

/** Sum settlement amounts of financial deductions (processed refunds + chargeback debit/loss). */
export function sumFinancialDeductionSettlementAmounts(
  adjustments: readonly Pick<
    PaymentAdjustmentRecord,
    "type" | "status" | "amount" | "settlementAmount"
  >[],
): string {
  const amounts = adjustments
    .filter((row) => isProcessedRefund(row) || isChargebackDebitLoss(row))
    .map((row) => row.settlementAmount ?? row.amount);
  return toDecimalString(sumMoney(amounts));
}

export function sumFinancialDeductionInvoiceAmounts(
  adjustments: readonly Pick<
    PaymentAdjustmentRecord,
    "type" | "status" | "invoiceAmount" | "amount"
  >[],
): string {
  const amounts = adjustments
    .filter((row) => isProcessedRefund(row) || isChargebackDebitLoss(row))
    .map((row) => row.invoiceAmount ?? "0");
  return toDecimalString(sumMoney(amounts));
}

export function assertCumulativeChargebackWithinPaymentCap(input: {
  readonly payment: Pick<PaymentRecord, "invoiceAmountApplied" | "convertedSettlementAmount">;
  readonly existingAdjustments: readonly Pick<
    PaymentAdjustmentRecord,
    "type" | "status" | "amount" | "invoiceAmount" | "settlementAmount"
  >[];
  readonly proposedInvoiceAmount: string;
  readonly proposedSettlementAmount: string;
}): void {
  const invoiceTotal = sumMoney([
    sumFinancialDeductionInvoiceAmounts(input.existingAdjustments),
    input.proposedInvoiceAmount,
  ]);
  const settlementTotal = sumMoney([
    sumFinancialDeductionSettlementAmounts(input.existingAdjustments),
    input.proposedSettlementAmount,
  ]);

  if (invoiceTotal.gt(moneyDecimal(input.payment.invoiceAmountApplied))) {
    throw new Error(CHARGEBACK_EXCEEDS_PAYMENT);
  }
  if (settlementTotal.gt(moneyDecimal(input.payment.convertedSettlementAmount))) {
    throw new Error(CHARGEBACK_EXCEEDS_PAYMENT);
  }
}

export function assertPaymentCanRecordChargebackDebitLoss(
  payment: Pick<PaymentRecord, "status" | "invoiceAmountApplied" | "convertedSettlementAmount">,
  existingAdjustments: readonly Pick<
    PaymentAdjustmentRecord,
    "type" | "status" | "amount" | "invoiceAmount" | "settlementAmount"
  >[],
  proposed: {
    readonly invoiceAmount: string;
    readonly settlementAmount: string;
  },
): void {
  if (payment.status !== "SUCCESSFUL") {
    throw new Error(CHARGEBACK_REQUIRES_SUCCESSFUL_PAYMENT);
  }
  const hasDebitLoss = existingAdjustments.some(isChargebackDebitLoss);
  if (hasDebitLoss) {
    throw new Error(CHARGEBACK_ALREADY_RECORDED);
  }
  assertCumulativeChargebackWithinPaymentCap({
    payment,
    existingAdjustments,
    proposedInvoiceAmount: proposed.invoiceAmount,
    proposedSettlementAmount: proposed.settlementAmount,
  });
}

export function assertChargebackDebitLossAdjustment(
  adjustment: Pick<PaymentAdjustmentRecord, "type" | "status">,
): void {
  if (!isChargebackDebitLoss(adjustment)) {
    throw new Error(CHARGEBACK_REQUIRES_SUCCESSFUL_PAYMENT);
  }
}

/**
 * Chargeback won/reversal requires SUCCESSFUL payment, an existing debit/loss, and no prior won/reversal.
 * Does not authorize editing the debit row (BR-023 / E2E-16).
 */
export function assertPaymentCanRecordChargebackWonReversal(
  payment: Pick<PaymentRecord, "status">,
  existingAdjustments: readonly Pick<PaymentAdjustmentRecord, "type" | "status">[],
): void {
  if (payment.status !== "SUCCESSFUL") {
    throw new Error(CHARGEBACK_WON_REQUIRES_SUCCESSFUL_PAYMENT);
  }
  if (!existingAdjustments.some(isChargebackDebitLoss)) {
    throw new Error(CHARGEBACK_WON_REQUIRES_DEBIT);
  }
  if (existingAdjustments.some(isChargebackWonReversal)) {
    throw new Error(CHARGEBACK_WON_ALREADY_RECORDED);
  }
}

export function assertChargebackWonReversalAdjustment(
  adjustment: Pick<PaymentAdjustmentRecord, "type" | "status">,
): void {
  if (!isChargebackWonReversal(adjustment)) {
    throw new Error(CHARGEBACK_WON_REQUIRES_DEBIT);
  }
}

export function findChargebackDebitLoss(
  adjustments: readonly PaymentAdjustmentRecord[],
): PaymentAdjustmentRecord | null {
  return adjustments.find(isChargebackDebitLoss) ?? null;
}

/** CB/RF after chargeback debit/loss includes the debit on the effective date (E2E-16 / BR-024). */
export function cbrfAfterChargebackDebitLoss(
  adjustments: readonly Pick<PaymentAdjustmentRecord, "type" | "status" | "amount">[],
  currencyCode: string,
  decimalPrecision: number,
): string {
  return computeCbrf({
    adjustments,
    currencyCode,
    decimalPrecision,
  }).amount;
}

/** CB/RF after won/reversal restores net impact vs prior debit (E2E-16 / BR-024). */
export function cbrfAfterChargebackWonReversal(
  adjustments: readonly Pick<PaymentAdjustmentRecord, "type" | "status" | "amount">[],
  currencyCode: string,
  decimalPrecision: number,
): string {
  return computeCbrf({
    adjustments,
    currencyCode,
    decimalPrecision,
  }).amount;
}

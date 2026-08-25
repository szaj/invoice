import { moneyDecimal, sumMoney, toDecimalString } from "@/domain/money";
import { computeCbrf } from "@/domain/money/cbrf";
import { isProcessedRefund, type PaymentAdjustmentRecord } from "@/domain/payments/adjustments";
import type { PaymentRecord } from "@/domain/payments/types";
import {
  REFUND_ALREADY_PROCESSED,
  REFUND_AMOUNT_INVALID,
  REFUND_EXCEEDS_PAYMENT,
  REFUND_REQUIRES_SUCCESSFUL_PAYMENT,
  REFUND_SETTLEMENT_AMOUNT_INVALID,
} from "@/domain/refunds/types";

/**
 * BR-025: use merchant actual settlement amount when provided; otherwise the original
 * payment's converted settlement (fixed-rate snapshot). Never today's active rate.
 */
export function resolveRefundSettlementAmount(input: {
  readonly paymentConvertedSettlementAmount: string;
  readonly actualSettlementAmount?: string | null;
}): string {
  const raw =
    input.actualSettlementAmount != null && input.actualSettlementAmount !== ""
      ? input.actualSettlementAmount
      : input.paymentConvertedSettlementAmount;
  const amount = moneyDecimal(raw);
  if (!amount.gt(0)) {
    throw new Error(REFUND_SETTLEMENT_AMOUNT_INVALID);
  }
  return toDecimalString(amount);
}

export function resolveFullRefundAmounts(input: {
  readonly payment: Pick<PaymentRecord, "invoiceAmountApplied" | "convertedSettlementAmount">;
  readonly actualSettlementAmount?: string | null;
}): {
  readonly invoiceAmount: string;
  readonly settlementAmount: string;
  readonly amount: string;
} {
  const invoiceAmount = toDecimalString(moneyDecimal(input.payment.invoiceAmountApplied));
  const settlementAmount = resolveRefundSettlementAmount({
    paymentConvertedSettlementAmount: input.payment.convertedSettlementAmount,
    actualSettlementAmount: input.actualSettlementAmount,
  });
  return {
    invoiceAmount,
    settlementAmount,
    /** CB/RF contribution uses settlement-currency amount (BR-025). */
    amount: settlementAmount,
  };
}

/**
 * Partial refund amounts (TASK-065 / BR-025).
 * Settlement = merchant actual when provided; else invoiceAmount × payment fixed-rate snapshot.
 * Never today's active rate.
 */
export function resolvePartialRefundAmounts(input: {
  readonly payment: Pick<
    PaymentRecord,
    "invoiceAmountApplied" | "convertedSettlementAmount" | "fixedConversionRate"
  >;
  readonly invoiceAmount: string;
  readonly actualSettlementAmount?: string | null;
}): {
  readonly invoiceAmount: string;
  readonly settlementAmount: string;
  readonly amount: string;
} {
  const invoiceAmount = moneyDecimal(input.invoiceAmount);
  if (!invoiceAmount.gt(0)) {
    throw new Error(REFUND_AMOUNT_INVALID);
  }

  let settlementAmount;
  if (input.actualSettlementAmount != null && input.actualSettlementAmount !== "") {
    settlementAmount = moneyDecimal(input.actualSettlementAmount);
  } else {
    // Original payment fixed-rate snapshot (BR-025) — never today's rate.
    settlementAmount = invoiceAmount.times(moneyDecimal(input.payment.fixedConversionRate));
  }
  if (!settlementAmount.gt(0)) {
    throw new Error(REFUND_SETTLEMENT_AMOUNT_INVALID);
  }

  return {
    invoiceAmount: toDecimalString(invoiceAmount),
    settlementAmount: toDecimalString(settlementAmount),
    /** CB/RF contribution uses settlement-currency amount (BR-025). */
    amount: toDecimalString(settlementAmount),
  };
}

/** Sum settlement (CB/RF) amounts of PROCESSED REFUND adjustments. */
export function sumProcessedRefundSettlementAmounts(
  adjustments: readonly Pick<
    PaymentAdjustmentRecord,
    "type" | "status" | "amount" | "settlementAmount"
  >[],
): string {
  const amounts = adjustments
    .filter(isProcessedRefund)
    .map((row) => row.settlementAmount ?? row.amount);
  return toDecimalString(sumMoney(amounts));
}

/** Sum invoice-currency amounts of PROCESSED REFUND adjustments. */
export function sumProcessedRefundInvoiceAmounts(
  adjustments: readonly Pick<
    PaymentAdjustmentRecord,
    "type" | "status" | "invoiceAmount" | "amount"
  >[],
): string {
  const amounts = adjustments.filter(isProcessedRefund).map((row) => row.invoiceAmount ?? "0");
  return toDecimalString(sumMoney(amounts));
}

/**
 * Cumulative cap: existing + proposed must not exceed original payment (TASK-065).
 * Over-refund rejected by default (no silent allow / correction override in V1).
 */
export function assertCumulativeRefundWithinPaymentCap(input: {
  readonly payment: Pick<PaymentRecord, "invoiceAmountApplied" | "convertedSettlementAmount">;
  readonly existingAdjustments: readonly Pick<
    PaymentAdjustmentRecord,
    "type" | "status" | "amount" | "invoiceAmount" | "settlementAmount"
  >[];
  readonly proposedInvoiceAmount: string;
  readonly proposedSettlementAmount: string;
}): void {
  const invoiceTotal = sumMoney([
    sumProcessedRefundInvoiceAmounts(input.existingAdjustments),
    input.proposedInvoiceAmount,
  ]);
  const settlementTotal = sumMoney([
    sumProcessedRefundSettlementAmounts(input.existingAdjustments),
    input.proposedSettlementAmount,
  ]);

  if (invoiceTotal.gt(moneyDecimal(input.payment.invoiceAmountApplied))) {
    throw new Error(REFUND_EXCEEDS_PAYMENT);
  }
  if (settlementTotal.gt(moneyDecimal(input.payment.convertedSettlementAmount))) {
    throw new Error(REFUND_EXCEEDS_PAYMENT);
  }
}

export function assertPaymentCanProcessFullRefund(
  payment: Pick<PaymentRecord, "status">,
  existingAdjustments: readonly Pick<PaymentAdjustmentRecord, "type" | "status">[],
): void {
  if (payment.status !== "SUCCESSFUL") {
    throw new Error(REFUND_REQUIRES_SUCCESSFUL_PAYMENT);
  }
  const hasProcessedRefund = existingAdjustments.some(
    (row) => row.type === "REFUND" && row.status === "PROCESSED",
  );
  if (hasProcessedRefund) {
    throw new Error(REFUND_ALREADY_PROCESSED);
  }
}

export function assertPaymentCanProcessPartialRefund(
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
    throw new Error(REFUND_REQUIRES_SUCCESSFUL_PAYMENT);
  }
  assertCumulativeRefundWithinPaymentCap({
    payment,
    existingAdjustments,
    proposedInvoiceAmount: proposed.invoiceAmount,
    proposedSettlementAmount: proposed.settlementAmount,
  });
}

export function assertProcessedRefundAdjustment(
  adjustment: Pick<PaymentAdjustmentRecord, "type" | "status">,
): void {
  if (adjustment.type !== "REFUND" || adjustment.status !== "PROCESSED") {
    throw new Error(REFUND_REQUIRES_SUCCESSFUL_PAYMENT);
  }
}

/** CB/RF after a processed full refund includes the refund amount (E2E-15). */
export function cbrfAfterFullRefund(
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

/** CB/RF after processed partial refund(s) includes only processed amounts (TASK-065). */
export function cbrfAfterPartialRefund(
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

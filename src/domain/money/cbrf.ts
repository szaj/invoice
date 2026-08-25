import { sumMoney } from "@/domain/money/convert";
import { moneyDecimal, normalizeCurrencyCode, toDecimalString } from "@/domain/money/decimal";
import { roundMoney } from "@/domain/money/round";
import type { DecimalInput, MonetaryValue } from "@/domain/money/types";
import {
  isChargebackDebitLoss,
  isChargebackWonReversal,
  isDisputeOpenStatus,
  isProcessedRefund,
  type PaymentAdjustmentStatus,
  type PaymentAdjustmentType,
} from "@/domain/payments/adjustments";

export type CbrfAdjustmentInput = {
  readonly type: PaymentAdjustmentType;
  readonly status: PaymentAdjustmentStatus;
  /** Settlement-currency amount when the adjustment is financial; ignored for open disputes. */
  readonly amount: DecimalInput;
};

export type GrossReceiptsPaymentInput = {
  readonly status: "PENDING" | "SUCCESSFUL" | "FAILED";
  /** Amount in the selected reporting/settlement currency (converted settlement for SUCCESSFUL). */
  readonly amount: DecimalInput;
};

export type CbrfBreakdown = {
  readonly processedRefunds: string;
  readonly chargebackDebitsLosses: string;
  readonly chargebackWonReversals: string;
  readonly cbrf: MonetaryValue;
};

export type ReportingNetTotals = {
  readonly grossReceipts: MonetaryValue;
  readonly cbrf: MonetaryValue;
  readonly netGTotal: MonetaryValue;
  /** Open/under-review disputes — shown separately; never deducted (BR-024). */
  readonly openDisputes: MonetaryValue;
};

/**
 * Open/under-review disputes are shown separately and excluded from CB/RF (BR-024).
 */
export function isOpenDisputeExcludedFromCbrf(
  adjustment: Pick<CbrfAdjustmentInput, "type" | "status">,
): boolean {
  return adjustment.type === "DISPUTE" && isDisputeOpenStatus(adjustment.status);
}

/**
 * Signed CB/RF contribution of one adjustment.
 * Open disputes, notes, and cancelled rows contribute 0 (TASK-068).
 * PROCESSED REFUND amounts are included (TASK-064 / TASK-065 / E2E-15).
 * CHARGEBACK DEBITED/LOST amounts are included (TASK-066 / E2E-16 / BR-024).
 * REVERSAL WON/REVERSED amounts subtract (TASK-067 / E2E-16 / BR-024).
 */
export function adjustmentCbrfContribution(adjustment: CbrfAdjustmentInput): string {
  if (
    isOpenDisputeExcludedFromCbrf(adjustment) ||
    adjustment.status === "CANCELLED" ||
    adjustment.type === "NOTE"
  ) {
    return "0";
  }
  if (isProcessedRefund(adjustment)) {
    return toDecimalString(moneyDecimal(adjustment.amount));
  }
  if (isChargebackDebitLoss(adjustment)) {
    return toDecimalString(moneyDecimal(adjustment.amount));
  }
  if (isChargebackWonReversal(adjustment)) {
    return toDecimalString(moneyDecimal(adjustment.amount).negated());
  }
  void moneyDecimal(adjustment.amount);
  return "0";
}

/**
 * CB/RF = processed refunds + chargeback debits/losses − won/reversals (BR-024 / TASK-070).
 * Open disputes contribute 0. Merchant/processor fees are never part of CB/RF.
 */
export function computeCbrf(input: {
  readonly adjustments: readonly CbrfAdjustmentInput[];
  readonly currencyCode: string;
  readonly decimalPrecision: number;
  /**
   * Optional merchant/processor fees (reconciliation only).
   * Must never be included in CB/RF (TASK-070 excluded / BR-020).
   */
  readonly processorFees?: readonly DecimalInput[] | null;
}): MonetaryValue {
  void input.processorFees;

  const total = sumMoney(input.adjustments.map((row) => adjustmentCbrfContribution(row)));
  return {
    amount: toDecimalString(roundMoney(total, input.decimalPrecision)),
    currencyCode: normalizeCurrencyCode(input.currencyCode),
  };
}

/**
 * Component breakdown of CB/RF for reporting/drill-down (TASK-070).
 * Formula: processedRefunds + chargebackDebitsLosses − chargebackWonReversals.
 */
export function computeCbrfBreakdown(input: {
  readonly adjustments: readonly CbrfAdjustmentInput[];
  readonly currencyCode: string;
  readonly decimalPrecision: number;
  readonly processorFees?: readonly DecimalInput[] | null;
}): CbrfBreakdown {
  void input.processorFees;

  const refunds = sumMoney(input.adjustments.filter(isProcessedRefund).map((row) => row.amount));
  const debits = sumMoney(input.adjustments.filter(isChargebackDebitLoss).map((row) => row.amount));
  const reversals = sumMoney(
    input.adjustments.filter(isChargebackWonReversal).map((row) => row.amount),
  );
  const cbrf = computeCbrf({
    adjustments: input.adjustments,
    currencyCode: input.currencyCode,
    decimalPrecision: input.decimalPrecision,
  });

  return {
    processedRefunds: toDecimalString(roundMoney(refunds, input.decimalPrecision)),
    chargebackDebitsLosses: toDecimalString(roundMoney(debits, input.decimalPrecision)),
    chargebackWonReversals: toDecimalString(roundMoney(reversals, input.decimalPrecision)),
    cbrf,
  };
}

/**
 * Gross Receipts = sum of Successful/Confirmed payments within selected scope (BR-026).
 * Merchant/processor fees are never included.
 */
export function computeGrossReceipts(input: {
  readonly payments: readonly GrossReceiptsPaymentInput[];
  readonly currencyCode: string;
  readonly decimalPrecision: number;
  /** Reconciliation only — never included in Gross Receipts. */
  readonly processorFees?: readonly DecimalInput[] | null;
}): MonetaryValue {
  void input.processorFees;

  const total = sumMoney(
    input.payments.filter((row) => row.status === "SUCCESSFUL").map((row) => row.amount),
  );
  return {
    amount: toDecimalString(roundMoney(total, input.decimalPrecision)),
    currencyCode: normalizeCurrencyCode(input.currencyCode),
  };
}

/**
 * Net G.Total = Gross Receipts − CB/RF for the selected period/reporting currency (BR-026).
 */
export function computeNetGTotal(input: {
  readonly grossReceipts: DecimalInput;
  readonly cbrf: DecimalInput;
  readonly currencyCode: string;
  readonly decimalPrecision: number;
}): MonetaryValue {
  const net = moneyDecimal(input.grossReceipts).minus(moneyDecimal(input.cbrf));
  return {
    amount: toDecimalString(roundMoney(net, input.decimalPrecision)),
    currencyCode: normalizeCurrencyCode(input.currencyCode),
  };
}

/**
 * Open dispute amounts reported separately — no revenue or CB/RF deduction (BR-024).
 */
export function sumOpenDisputeAmounts(input: {
  readonly adjustments: readonly CbrfAdjustmentInput[];
  readonly currencyCode: string;
  readonly decimalPrecision: number;
}): MonetaryValue {
  const total = sumMoney(
    input.adjustments.filter((row) => isOpenDisputeExcludedFromCbrf(row)).map((row) => row.amount),
  );
  return {
    amount: toDecimalString(roundMoney(total, input.decimalPrecision)),
    currencyCode: normalizeCurrencyCode(input.currencyCode),
  };
}

/**
 * Shared reporting totals used by dashboard/reports later (TASK-070 / BR-024 / BR-026).
 * Fees never alter Gross Receipts, CB/RF, or Net G.Total.
 */
export function computeReportingNetTotals(input: {
  readonly payments: readonly GrossReceiptsPaymentInput[];
  readonly adjustments: readonly CbrfAdjustmentInput[];
  readonly currencyCode: string;
  readonly decimalPrecision: number;
  readonly processorFees?: readonly DecimalInput[] | null;
}): ReportingNetTotals {
  const grossReceipts = computeGrossReceipts({
    payments: input.payments,
    currencyCode: input.currencyCode,
    decimalPrecision: input.decimalPrecision,
    processorFees: input.processorFees,
  });
  const cbrf = computeCbrf({
    adjustments: input.adjustments,
    currencyCode: input.currencyCode,
    decimalPrecision: input.decimalPrecision,
    processorFees: input.processorFees,
  });
  const netGTotal = computeNetGTotal({
    grossReceipts: grossReceipts.amount,
    cbrf: cbrf.amount,
    currencyCode: input.currencyCode,
    decimalPrecision: input.decimalPrecision,
  });
  const openDisputes = sumOpenDisputeAmounts({
    adjustments: input.adjustments,
    currencyCode: input.currencyCode,
    decimalPrecision: input.decimalPrecision,
  });

  return { grossReceipts, cbrf, netGTotal, openDisputes };
}

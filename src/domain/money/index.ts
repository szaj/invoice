/**
 * Centralized financial calculation layer (ADR-004 / TASK-019).
 * Authoritative money uses Prisma Decimal — never JavaScript number arithmetic.
 */

export {
  moneyDecimal,
  normalizeCurrencyCode,
  assertCurrencyPrecision,
  toDecimalString,
} from "@/domain/money/decimal";
export { roundMoney, isWithinRoundingTolerance } from "@/domain/money/round";
export {
  computeConvertedSettlementAmount,
  sumMoney,
  type ConvertedSettlementInput,
  type ConvertedSettlementResult,
} from "@/domain/money/convert";
export {
  computeInvoiceOutstanding,
  assertSameCurrencyCodes,
  type InvoiceOutstandingInput,
} from "@/domain/money/outstanding";
export {
  computeCbrf,
  computeCbrfBreakdown,
  computeGrossReceipts,
  computeNetGTotal,
  computeReportingNetTotals,
  sumOpenDisputeAmounts,
  adjustmentCbrfContribution,
  isOpenDisputeExcludedFromCbrf,
  type CbrfAdjustmentInput,
  type CbrfBreakdown,
  type GrossReceiptsPaymentInput,
  type ReportingNetTotals,
} from "@/domain/money/cbrf";
export { formatMoneyForDisplay } from "@/domain/money/format";
export {
  toMinorUnits,
  toProviderAmountInteger,
  toProviderAmountDecimalString,
  normalizeProviderCurrencyCode,
} from "@/domain/money/minor-units";
export {
  DEFAULT_MONEY_ROUNDING_MODE,
  MONEY_INVALID_CURRENCY_CODE,
  MONEY_INVALID_DECIMAL,
  MONEY_INVALID_PRECISION,
  MONEY_MIXED_CURRENCY,
  type DecimalInput,
  type MonetaryValue,
} from "@/domain/money/types";

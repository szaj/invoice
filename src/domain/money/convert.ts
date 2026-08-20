import { Decimal } from "@prisma/client/runtime/client";

import { moneyDecimal, normalizeCurrencyCode, toDecimalString } from "@/domain/money/decimal";
import { roundMoney } from "@/domain/money/round";
import type { DecimalInput, MonetaryValue } from "@/domain/money/types";
import { SAME_CURRENCY_FIXED_RATE } from "@/domain/fixed-rates/types";

export type ConvertedSettlementInput = {
  readonly invoiceAmountApplied: DecimalInput;
  readonly invoiceCurrencyCode: string;
  readonly settlementCurrencyCode: string;
  /**
   * Admin-defined fixed conversion rate for invoice → settlement.
   * Ignored when currencies are the same (forced to 1).
   */
  readonly fixedConversionRate: DecimalInput;
  /** Settlement currency catalog decimal precision (0–6). */
  readonly settlementDecimalPrecision: number;
  /**
   * Optional merchant/processor fee (reconciliation only).
   * Must never affect convertedSettlementAmount (BR-020).
   */
  readonly processorFee?: DecimalInput | null;
};

export type ConvertedSettlementResult = {
  readonly convertedSettlementAmount: MonetaryValue;
  readonly fixedConversionRateApplied: string;
  readonly rateSource: "same_currency" | "admin_fixed_rate";
  /** Echoed for audit/debug; never included in the product. */
  readonly processorFeeExcluded: boolean;
};

/**
 * converted_settlement_amount = invoice_amount_applied × fixed_conversion_rate
 * Merchant/processor fee is excluded from the formula.
 */
export function computeConvertedSettlementAmount(
  input: ConvertedSettlementInput,
): ConvertedSettlementResult {
  const invoiceCurrency = normalizeCurrencyCode(input.invoiceCurrencyCode);
  const settlementCurrency = normalizeCurrencyCode(input.settlementCurrencyCode);
  const sameCurrency = invoiceCurrency === settlementCurrency;

  const rateApplied = sameCurrency
    ? moneyDecimal(SAME_CURRENCY_FIXED_RATE)
    : moneyDecimal(input.fixedConversionRate);

  if (!sameCurrency && !rateApplied.gt(0)) {
    throw new Error("Fixed conversion rate must be greater than zero.");
  }

  // Deliberately ignore processorFee — reconciliation only (BR-020).
  void input.processorFee;

  const raw = moneyDecimal(input.invoiceAmountApplied).times(rateApplied);
  const rounded = roundMoney(raw, input.settlementDecimalPrecision);

  return {
    convertedSettlementAmount: {
      amount: toDecimalString(rounded),
      currencyCode: settlementCurrency,
    },
    fixedConversionRateApplied: toDecimalString(rateApplied),
    rateSource: sameCurrency ? "same_currency" : "admin_fixed_rate",
    processorFeeExcluded: true,
  };
}

/** Sum Decimal amounts without JS number math. */
export function sumMoney(amounts: readonly DecimalInput[]): Decimal {
  return amounts.reduce<Decimal>(
    (total, amount) => total.plus(moneyDecimal(amount)),
    new Decimal(0),
  );
}

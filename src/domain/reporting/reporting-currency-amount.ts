import { selectEffectiveRate } from "@/domain/fixed-rates/resolve-rate";
import type { FixedConversionRateRecord } from "@/domain/fixed-rates/types";
import { moneyDecimal, normalizeCurrencyCode, toDecimalString } from "@/domain/money/decimal";
import { roundMoney } from "@/domain/money/round";
import type { DecimalInput } from "@/domain/money/types";

export type ReportingCurrencyConversionResult =
  | { readonly ok: true; readonly amount: string }
  | { readonly ok: false; readonly reason: "missing_rate" };

/**
 * Convert a settlement-currency amount into the configured reporting currency
 * using Admin fixed-rate snapshots at `at`. Never uses live FX (BR-020 / BR-021).
 */
export function convertSettlementAmountToReportingCurrency(input: {
  readonly settlementAmount: DecimalInput;
  readonly settlementCurrencyCode: string;
  readonly reportingCurrencyCode: string;
  readonly at: Date;
  readonly decimalPrecision: number;
  readonly fixedRates: readonly FixedConversionRateRecord[];
}): ReportingCurrencyConversionResult {
  const settlementCurrency = normalizeCurrencyCode(input.settlementCurrencyCode);
  const reportingCurrency = normalizeCurrencyCode(input.reportingCurrencyCode);

  if (settlementCurrency === reportingCurrency) {
    return {
      ok: true,
      amount: toDecimalString(
        roundMoney(moneyDecimal(input.settlementAmount), input.decimalPrecision),
      ),
    };
  }

  const rate = selectEffectiveRate(
    input.fixedRates,
    settlementCurrency,
    reportingCurrency,
    input.at,
  );
  if (!rate.ok) {
    return { ok: false, reason: "missing_rate" };
  }

  const converted = moneyDecimal(input.settlementAmount).times(moneyDecimal(rate.fixedRate));
  return {
    ok: true,
    amount: toDecimalString(roundMoney(converted, input.decimalPrecision)),
  };
}

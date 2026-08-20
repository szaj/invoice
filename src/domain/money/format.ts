import {
  assertCurrencyPrecision,
  moneyDecimal,
  normalizeCurrencyCode,
} from "@/domain/money/decimal";
import type { DecimalInput } from "@/domain/money/types";

/**
 * Display-only formatting. Never trust this for authoritative totals —
 * backend Decimal calculations remain the source of truth.
 */
export function formatMoneyForDisplay(
  amount: DecimalInput,
  currencyCode: string,
  decimalPrecision: number,
): string {
  const precision = assertCurrencyPrecision(decimalPrecision);
  const code = normalizeCurrencyCode(currencyCode);
  const formatted = moneyDecimal(amount).toFixed(precision);
  return `${formatted} ${code}`;
}

import { Decimal } from "@prisma/client/runtime/client";

import { assertCurrencyPrecision, moneyDecimal } from "@/domain/money/decimal";
import { DEFAULT_MONEY_ROUNDING_MODE, type DecimalInput } from "@/domain/money/types";

/**
 * Round an authoritative money amount to a currency's decimal precision.
 * Uses half-up rounding (server-side source of truth).
 */
export function roundMoney(
  amount: DecimalInput,
  decimalPrecision: number,
  roundingMode: Decimal.Rounding = DEFAULT_MONEY_ROUNDING_MODE,
): Decimal {
  const precision = assertCurrencyPrecision(decimalPrecision);
  return moneyDecimal(amount).toDecimalPlaces(precision, roundingMode);
}

/**
 * Compare two amounts using system-settings rounding tolerance.
 * `|left - right| <= tolerance` — Decimal math only.
 */
export function isWithinRoundingTolerance(
  left: DecimalInput,
  right: DecimalInput,
  roundingTolerance: DecimalInput,
): boolean {
  const tolerance = moneyDecimal(roundingTolerance);
  if (tolerance.isNeg()) {
    throw new Error("Rounding tolerance must be non-negative.");
  }
  return moneyDecimal(left).minus(moneyDecimal(right)).abs().lte(tolerance);
}

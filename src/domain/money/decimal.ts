import { Decimal } from "@prisma/client/runtime/client";

import {
  MONEY_INVALID_CURRENCY_CODE,
  MONEY_INVALID_DECIMAL,
  MONEY_INVALID_PRECISION,
  type DecimalInput,
} from "@/domain/money/types";

/**
 * Parse an authoritative money/rate value as Prisma Decimal.
 * Rejects JavaScript numbers at runtime to prevent float leakage into the financial layer.
 */
export function moneyDecimal(value: DecimalInput | number): Decimal {
  if (typeof value === "number") {
    throw new TypeError(
      "JavaScript number is not allowed for authoritative money. Pass a Decimal or decimal string.",
    );
  }
  if (value instanceof Decimal) {
    if (!value.isFinite()) {
      throw new Error(MONEY_INVALID_DECIMAL);
    }
    return value;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(MONEY_INVALID_DECIMAL);
  }
  try {
    const parsed = new Decimal(value.trim());
    if (!parsed.isFinite()) {
      throw new Error(MONEY_INVALID_DECIMAL);
    }
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message === MONEY_INVALID_DECIMAL) {
      throw error;
    }
    throw new Error(MONEY_INVALID_DECIMAL);
  }
}

export function normalizeCurrencyCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error(MONEY_INVALID_CURRENCY_CODE);
  }
  return normalized;
}

export function assertCurrencyPrecision(precision: number): number {
  if (!Number.isInteger(precision) || precision < 0 || precision > 6) {
    throw new Error(MONEY_INVALID_PRECISION);
  }
  return precision;
}

/** Wire/storage form — Decimal string, never JS number. */
export function toDecimalString(value: DecimalInput): string {
  return moneyDecimal(value).toString();
}

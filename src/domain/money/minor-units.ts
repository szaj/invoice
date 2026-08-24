import { Decimal } from "@prisma/client/runtime/client";

import {
  assertCurrencyPrecision,
  moneyDecimal,
  normalizeCurrencyCode,
} from "@/domain/money/decimal";
import type { DecimalInput } from "@/domain/money/types";

/**
 * Convert an authoritative decimal money amount to integer minor units for a provider API.
 * Uses Prisma Decimal only — never JavaScript floating-point arithmetic.
 */
export function toMinorUnits(amount: DecimalInput, decimalPrecision: number): bigint {
  const precision = assertCurrencyPrecision(decimalPrecision);
  const scaled = moneyDecimal(amount).mul(new Decimal(10).pow(precision));
  if (!scaled.isInteger()) {
    throw new Error("Money amount is not aligned to the currency decimal precision.");
  }
  return BigInt(scaled.toFixed(0));
}

/**
 * Stripe/Checkout-style APIs accept a JS number for amount. Convert only at the adapter boundary
 * after Decimal scaling, and reject values that cannot be represented safely as an integer Number.
 */
export function toProviderAmountInteger(amount: DecimalInput, decimalPrecision: number): number {
  const minor = toMinorUnits(amount, decimalPrecision);
  if (minor > BigInt(Number.MAX_SAFE_INTEGER) || minor < 0n) {
    throw new Error("Money amount is out of range for the payment provider API.");
  }
  return Number(minor);
}

/**
 * PayPal-style APIs accept a decimal string amount (not integer minor units).
 * Aligns to currency precision via Decimal; never JavaScript floating-point.
 */
export function toProviderAmountDecimalString(
  amount: DecimalInput,
  decimalPrecision: number,
): string {
  const precision = assertCurrencyPrecision(decimalPrecision);
  // Validates alignment the same way as toMinorUnits.
  void toMinorUnits(amount, precision);
  return moneyDecimal(amount).toFixed(precision);
}

export function normalizeProviderCurrencyCode(code: string): string {
  return normalizeCurrencyCode(code).toLowerCase();
}

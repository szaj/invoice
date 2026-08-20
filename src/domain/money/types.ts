import { Decimal } from "@prisma/client/runtime/client";

/** Authoritative money/rate input: Decimal or decimal string — never JS number. */
export type DecimalInput = Decimal | string;

export type MonetaryValue = {
  /** Decimal string for wire/storage; never JS number. */
  readonly amount: string;
  readonly currencyCode: string;
};

export const MONEY_INVALID_DECIMAL = "Money values must be valid decimal strings.";
export const MONEY_INVALID_CURRENCY_CODE = "Currency code must be a 3-letter ISO-style code.";
export const MONEY_INVALID_PRECISION = "Currency decimal precision must be an integer from 0 to 6.";
export const MONEY_MIXED_CURRENCY =
  "Mixed-currency amounts cannot be combined into a single unlabeled total. Convert to a labeled reporting currency first.";

export const DEFAULT_MONEY_ROUNDING_MODE = Decimal.ROUND_HALF_UP;

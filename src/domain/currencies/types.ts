export type CurrencyStatus = "ACTIVE" | "INACTIVE";

export type CurrencyRecord = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
  readonly decimalPrecision: number;
  readonly status: CurrencyStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export const CURRENCY_NOT_FOUND = "Currency not found.";
export const CURRENCY_INVALID_INPUT = "Check the currency details and try again.";
export const CURRENCY_CODE_CONFLICT = "A currency with this code already exists.";
export const CURRENCY_UNAVAILABLE = "Currency management is temporarily unavailable.";

/** Seeded default codes from Currency and Conversion §6.1. */
export const DEFAULT_CURRENCY_CODES = ["USD", "AED", "PKR", "GBP", "AUD"] as const;

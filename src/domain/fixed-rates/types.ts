export type FixedConversionRateStatus = "ACTIVE" | "EXPIRED";
export type FixedConversionRateFrequency = "MONTHLY" | "YEARLY" | "MANUAL";

/** Wire/API shape: fixedRate is a decimal string — never JS number math. */
export type FixedConversionRateRecord = {
  readonly id: string;
  readonly fromCurrency: string;
  readonly toCurrency: string;
  readonly fixedRate: string;
  readonly versionNo: number;
  readonly frequencyLabel: FixedConversionRateFrequency;
  readonly validFrom: Date;
  readonly validTo: Date | null;
  readonly status: FixedConversionRateStatus;
  readonly notes: string | null;
  readonly createdByUserId: string | null;
  readonly createdAt: Date;
};

export const FIXED_RATE_INVALID_INPUT = "Check the fixed conversion rate and try again.";
export const FIXED_RATE_CURRENCY_NOT_FOUND =
  "Both from and to currencies must exist in the currency catalog.";
export const FIXED_RATE_SAME_CURRENCY = "From and to currencies must be different.";
export const FIXED_RATE_UNAVAILABLE = "Fixed conversion rates are temporarily unavailable.";

/**
 * Missing Admin fixed rate for a cross-currency conversion at a timestamp.
 * Callers must block conversion and must never substitute a market/gateway rate.
 */
export const FIXED_RATE_MISSING_FOR_CONVERSION =
  "No Admin-defined fixed conversion rate is configured for this currency pair at the requested time. Configure a fixed rate in Settings before converting. Market or gateway rates are never used.";

/** Same-currency conversion rate as a Decimal string (12 fractional places). */
export const SAME_CURRENCY_FIXED_RATE = "1.000000000000";

export const FIXED_RATE_FREQUENCIES: readonly FixedConversionRateFrequency[] = [
  "MONTHLY",
  "YEARLY",
  "MANUAL",
];

export type EffectiveRateSuccess = {
  readonly ok: true;
  readonly fromCurrency: string;
  readonly toCurrency: string;
  readonly at: Date;
  /** Decimal string — never JS number math. */
  readonly fixedRate: string;
  readonly rateSource: "same_currency" | "admin_fixed_rate";
  readonly rateVersionId: string | null;
  readonly versionNo: number | null;
  readonly validFrom: Date | null;
  readonly validTo: Date | null;
  readonly status: FixedConversionRateStatus | null;
};

export type EffectiveRateFailure = {
  readonly ok: false;
  readonly error: typeof FIXED_RATE_MISSING_FOR_CONVERSION;
  readonly fromCurrency: string;
  readonly toCurrency: string;
  readonly at: Date;
};

export type EffectiveRateResult = EffectiveRateSuccess | EffectiveRateFailure;

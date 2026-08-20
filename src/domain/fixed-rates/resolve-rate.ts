import {
  FIXED_RATE_MISSING_FOR_CONVERSION,
  SAME_CURRENCY_FIXED_RATE,
  type EffectiveRateResult,
  type FixedConversionRateRecord,
} from "@/domain/fixed-rates/types";

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Whether version `rate` covers timestamp `at`.
 * Window: validFrom <= at < validTo (validTo null = open-ended).
 * Status is not authoritative — EXPIRED versions remain selectable inside their window.
 */
export function rateCoversTimestamp(rate: FixedConversionRateRecord, at: Date): boolean {
  const atMs = at.getTime();
  if (rate.validFrom.getTime() > atMs) {
    return false;
  }
  if (rate.validTo !== null && atMs >= rate.validTo.getTime()) {
    return false;
  }
  return true;
}

/**
 * Select the Admin-defined fixed rate effective for a currency pair at `at`.
 * Same-currency pairs resolve to 1.000000000000 without a catalog row.
 * Never invents, fetches, or substitutes a market/gateway rate.
 */
export function selectEffectiveRate(
  candidates: readonly FixedConversionRateRecord[],
  fromCurrency: string,
  toCurrency: string,
  at: Date,
): EffectiveRateResult {
  const from = normalizeCode(fromCurrency);
  const to = normalizeCode(toCurrency);

  if (from === to) {
    return {
      ok: true,
      fromCurrency: from,
      toCurrency: to,
      at,
      fixedRate: SAME_CURRENCY_FIXED_RATE,
      rateSource: "same_currency",
      rateVersionId: null,
      versionNo: null,
      validFrom: null,
      validTo: null,
      status: null,
    };
  }

  const covering = candidates
    .filter(
      (rate) =>
        rate.fromCurrency === from && rate.toCurrency === to && rateCoversTimestamp(rate, at),
    )
    .sort((a, b) => {
      const byFrom = b.validFrom.getTime() - a.validFrom.getTime();
      if (byFrom !== 0) {
        return byFrom;
      }
      return b.versionNo - a.versionNo;
    });

  const selected = covering[0];
  if (!selected) {
    return {
      ok: false,
      error: FIXED_RATE_MISSING_FOR_CONVERSION,
      fromCurrency: from,
      toCurrency: to,
      at,
    };
  }

  return {
    ok: true,
    fromCurrency: from,
    toCurrency: to,
    at,
    fixedRate: selected.fixedRate,
    rateSource: "admin_fixed_rate",
    rateVersionId: selected.id,
    versionNo: selected.versionNo,
    validFrom: selected.validFrom,
    validTo: selected.validTo,
    status: selected.status,
  };
}

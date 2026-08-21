import type { CurrencyStatus } from "@/domain/currencies/types";
import {
  CURRENCY_DISABLED_FOR_NEW_SELECTION,
  CURRENCY_NOT_ENABLED_FOR_COMPANY,
} from "@/domain/currencies/types";

export type CurrencySelectionFacts = {
  readonly globalStatus: CurrencyStatus;
  readonly companyEnabled: boolean;
};

export type CurrencyPickerOption = {
  readonly currencyId: string;
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
  readonly decimalPrecision: number;
  readonly globalStatus: CurrencyStatus;
  readonly companyEnabled: boolean;
};

/**
 * BR-002 + BR-011: new invoices/payments may only select a globally ACTIVE currency
 * that is enabled for the company. Disabled currencies remain valid on historical records.
 */
export function assertCurrencySelectableForNewDocument(
  facts: CurrencySelectionFacts | null | undefined,
):
  | { ok: true }
  | {
      ok: false;
      error: typeof CURRENCY_DISABLED_FOR_NEW_SELECTION | typeof CURRENCY_NOT_ENABLED_FOR_COMPANY;
    } {
  if (!facts) {
    return { ok: false, error: CURRENCY_NOT_ENABLED_FOR_COMPANY };
  }
  if (facts.globalStatus !== "ACTIVE") {
    return { ok: false, error: CURRENCY_DISABLED_FOR_NEW_SELECTION };
  }
  if (!facts.companyEnabled) {
    return { ok: false, error: CURRENCY_NOT_ENABLED_FOR_COMPANY };
  }
  return { ok: true };
}

/** Options shown on new-document pickers: globally ACTIVE and company-enabled only. */
export function currenciesForNewDocumentPicker<T extends CurrencyPickerOption>(
  options: readonly T[],
): T[] {
  return options.filter(
    (option) => option.globalStatus === "ACTIVE" && option.companyEnabled === true,
  );
}

/**
 * BR-011 historical display: return catalog metadata even when INACTIVE.
 * Never blanks, renames, or rewrites a stored historical currency code.
 */
export function currencyLabelForHistoricalDisplay(currency: {
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
  readonly status?: CurrencyStatus;
  readonly globalStatus?: CurrencyStatus;
}): string {
  const code = currency.code.trim().toUpperCase();
  const status = currency.status ?? currency.globalStatus;
  const base = `${code} — ${currency.name} (${currency.symbol})`;
  if (status === "INACTIVE") {
    return `${base} [disabled]`;
  }
  return base;
}

export function isCurrencySelectableForNewDocument(
  facts: CurrencySelectionFacts | null | undefined,
): boolean {
  return assertCurrencySelectableForNewDocument(facts).ok;
}

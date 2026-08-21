import "server-only";

import { companyIdSchema } from "@/domain/companies/company-schema";
import {
  assertCurrencySelectableForNewDocument,
  currenciesForNewDocumentPicker,
  currencyLabelForHistoricalDisplay,
  type CurrencyPickerOption,
} from "@/domain/currencies/selection";
import { currencyIdSchema } from "@/domain/currencies/schema";
import {
  CURRENCY_DISABLED_FOR_NEW_SELECTION,
  CURRENCY_NOT_ENABLED_FOR_COMPANY,
  CURRENCY_NOT_FOUND,
  CURRENCY_UNAVAILABLE,
  type CurrencyRecord,
} from "@/domain/currencies/types";
import { COMPANY_NOT_FOUND_MESSAGE } from "@/domain/companies/types";
import { logger } from "@/lib/logger";
import { PrismaCompanyCurrencyStore } from "@/server/companies/company-currency-repository";
import { PrismaCurrencyStore } from "@/server/currencies/currency-repository";

export type CurrencySelectionResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 404 | 503; error: string };

export interface CurrencySelectionDependencies {
  readonly companyCurrencyStore: Pick<
    PrismaCompanyCurrencyStore,
    "getCompanyCurrencyConfiguration" | "companyExists"
  >;
  readonly currencyStore: Pick<PrismaCurrencyStore, "getCurrencyById" | "findByCode">;
}

export function createDefaultCurrencySelectionDependencies(): CurrencySelectionDependencies {
  return {
    companyCurrencyStore: new PrismaCompanyCurrencyStore(),
    currencyStore: new PrismaCurrencyStore(),
  };
}

/**
 * Validation hook for later invoice/payment create (BR-002 / BR-011).
 * Does not require Admin permission — callers enforce their own authz.
 */
export async function validateCurrencyForNewDocument(
  companyId: string,
  currencyId: string,
  deps: CurrencySelectionDependencies = createDefaultCurrencySelectionDependencies(),
): Promise<
  CurrencySelectionResult<{
    currencyId: string;
    code: string;
    name: string;
    symbol: string;
    decimalPrecision: number;
  }>
> {
  try {
    const parsedCompanyId = companyIdSchema.safeParse(companyId);
    if (!parsedCompanyId.success) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }
    const parsedCurrencyId = currencyIdSchema.safeParse(currencyId);
    if (!parsedCurrencyId.success) {
      return { ok: false, status: 404, error: CURRENCY_NOT_FOUND };
    }

    if (!(await deps.companyCurrencyStore.companyExists(parsedCompanyId.data))) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const config = await deps.companyCurrencyStore.getCompanyCurrencyConfiguration(
      parsedCompanyId.data,
    );
    if (!config) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const option = config.currencies.find(
      (currency) => currency.currencyId === parsedCurrencyId.data,
    );
    if (!option) {
      return { ok: false, status: 404, error: CURRENCY_NOT_FOUND };
    }

    const check = assertCurrencySelectableForNewDocument({
      globalStatus: option.globalStatus,
      companyEnabled: option.enabled,
    });
    if (!check.ok) {
      return { ok: false, status: 400, error: check.error };
    }

    return {
      ok: true,
      data: {
        currencyId: option.currencyId,
        code: option.code,
        name: option.name,
        symbol: option.symbol,
        decimalPrecision: option.decimalPrecision,
      },
    };
  } catch (error) {
    logger.error(
      {
        event: "currencies.selection_unavailable",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Currency selection validation failed",
    );
    return { ok: false, status: 503, error: CURRENCY_UNAVAILABLE };
  }
}

/**
 * BR-002 validation by currency code (invoice header stores codes).
 */
export async function validateCurrencyCodeForNewDocument(
  companyId: string,
  currencyCode: string,
  deps: CurrencySelectionDependencies = createDefaultCurrencySelectionDependencies(),
): Promise<
  CurrencySelectionResult<{
    currencyId: string;
    code: string;
    name: string;
    symbol: string;
    decimalPrecision: number;
  }>
> {
  try {
    const parsedCompanyId = companyIdSchema.safeParse(companyId);
    if (!parsedCompanyId.success) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }
    const code = currencyCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      return { ok: false, status: 400, error: CURRENCY_NOT_ENABLED_FOR_COMPANY };
    }

    if (!(await deps.companyCurrencyStore.companyExists(parsedCompanyId.data))) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const config = await deps.companyCurrencyStore.getCompanyCurrencyConfiguration(
      parsedCompanyId.data,
    );
    if (!config) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const option = config.currencies.find((currency) => currency.code === code);
    if (!option) {
      return { ok: false, status: 400, error: CURRENCY_NOT_ENABLED_FOR_COMPANY };
    }

    const check = assertCurrencySelectableForNewDocument({
      globalStatus: option.globalStatus,
      companyEnabled: option.enabled,
    });
    if (!check.ok) {
      return { ok: false, status: 400, error: check.error };
    }

    return {
      ok: true,
      data: {
        currencyId: option.currencyId,
        code: option.code,
        name: option.name,
        symbol: option.symbol,
        decimalPrecision: option.decimalPrecision,
      },
    };
  } catch (error) {
    logger.error(
      {
        event: "currencies.code_selection_unavailable",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Currency code selection validation failed",
    );
    return { ok: false, status: 503, error: CURRENCY_UNAVAILABLE };
  }
}

/**
 * Options for new-document currency pickers: ACTIVE + company-enabled only.
 * Callers enforce authorization and company access.
 */
export async function listCurrenciesForNewDocument(
  companyId: string,
  deps: CurrencySelectionDependencies = createDefaultCurrencySelectionDependencies(),
): Promise<CurrencySelectionResult<CurrencyPickerOption[]>> {
  try {
    const parsedCompanyId = companyIdSchema.safeParse(companyId);
    if (!parsedCompanyId.success) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const config = await deps.companyCurrencyStore.getCompanyCurrencyConfiguration(
      parsedCompanyId.data,
    );
    if (!config) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const options: CurrencyPickerOption[] = config.currencies.map((currency) => ({
      currencyId: currency.currencyId,
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      decimalPrecision: currency.decimalPrecision,
      globalStatus: currency.globalStatus,
      companyEnabled: currency.enabled,
    }));

    return { ok: true, data: currenciesForNewDocumentPicker(options) };
  } catch (error) {
    logger.error(
      {
        event: "currencies.picker_unavailable",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Currency picker list failed",
    );
    return { ok: false, status: 503, error: CURRENCY_UNAVAILABLE };
  }
}

/**
 * Historical visibility (BR-011 / Error Handling): resolve catalog metadata for a
 * stored currency code even when the currency is now INACTIVE. Never rewrites the code.
 */
export async function resolveCurrencyForHistoricalDisplay(
  currencyCode: string,
  deps: CurrencySelectionDependencies = createDefaultCurrencySelectionDependencies(),
): Promise<
  CurrencySelectionResult<{
    code: string;
    name: string;
    symbol: string;
    decimalPrecision: number;
    status: CurrencyRecord["status"];
    label: string;
  }>
> {
  try {
    const code = currencyCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      return { ok: false, status: 404, error: CURRENCY_NOT_FOUND };
    }

    const currency = await deps.currencyStore.findByCode(code);
    if (!currency) {
      return { ok: false, status: 404, error: CURRENCY_NOT_FOUND };
    }

    return {
      ok: true,
      data: {
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        decimalPrecision: currency.decimalPrecision,
        status: currency.status,
        label: currencyLabelForHistoricalDisplay(currency),
      },
    };
  } catch (error) {
    logger.error(
      {
        event: "currencies.historical_unavailable",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Historical currency resolve failed",
    );
    return { ok: false, status: 503, error: CURRENCY_UNAVAILABLE };
  }
}

export { CURRENCY_DISABLED_FOR_NEW_SELECTION, CURRENCY_NOT_ENABLED_FOR_COMPANY };

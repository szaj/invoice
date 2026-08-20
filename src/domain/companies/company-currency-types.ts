export type CompanyCurrencyOption = {
  readonly currencyId: string;
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
  readonly decimalPrecision: number;
  readonly globalStatus: "ACTIVE" | "INACTIVE";
  readonly enabled: boolean;
  readonly isDefault: boolean;
};

export type CompanyCurrencyConfiguration = {
  readonly companyId: string;
  readonly companyDisplayName: string;
  readonly currencies: readonly CompanyCurrencyOption[];
  readonly enabledCurrencyIds: readonly string[];
  readonly defaultCurrencyId: string | null;
};

export const COMPANY_CURRENCY_INVALID_INPUT = "Check the company currency settings and try again.";
export const COMPANY_CURRENCY_INACTIVE_GLOBAL =
  "Only globally active currencies can be enabled for a company.";
export const COMPANY_CURRENCY_DEFAULT_REQUIRED =
  "Choose a default invoice currency from the enabled set.";
export const COMPANY_CURRENCY_DEFAULT_NOT_ENABLED =
  "The default invoice currency must be one of the enabled currencies.";
export const COMPANY_CURRENCY_UNAVAILABLE =
  "Company currency settings are temporarily unavailable.";

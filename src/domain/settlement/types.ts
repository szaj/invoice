/** Version 1 payment method codes — provider-agnostic; adapters later (ADR-008). */
export const PAYMENT_METHOD_CODES = ["STRIPE", "PAYPAL", "BANK_PROCESSOR", "MANUAL"] as const;

export type PaymentMethodCode = (typeof PAYMENT_METHOD_CODES)[number];

/** BR-007: initial settlement currencies. Admin may enable other ACTIVE catalog codes. */
export const INITIAL_SETTLEMENT_CURRENCY_CODES = ["USD", "AED"] as const;

export type SettlementCurrencyFlag = {
  readonly currencyCode: string;
  readonly name: string;
  readonly globalStatus: "ACTIVE" | "INACTIVE";
  readonly enabled: boolean;
  readonly isInitial: boolean;
};

export type PaymentMethodSettlementConfig = {
  readonly methodCode: PaymentMethodCode;
  readonly methodEnabled: boolean;
  readonly settlementCurrencies: readonly SettlementCurrencyFlag[];
  readonly enabledSettlementCurrencyCodes: readonly string[];
};

export type CompanySettlementConfiguration = {
  readonly companyId: string;
  readonly companyDisplayName: string;
  readonly methods: readonly PaymentMethodSettlementConfig[];
};

export const SETTLEMENT_INVALID_INPUT = "Check the settlement currency settings and try again.";
export const SETTLEMENT_CURRENCY_NOT_ENABLED =
  "That settlement currency is not enabled for the selected payment method and company.";
export const SETTLEMENT_CURRENCY_INACTIVE_GLOBAL =
  "Globally inactive currencies cannot be newly enabled as settlement currencies.";
export const SETTLEMENT_METHOD_NOT_FOUND = "Payment method configuration was not found.";
export const SETTLEMENT_UNAVAILABLE = "Settlement currency settings are temporarily unavailable.";

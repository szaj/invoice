import {
  SETTLEMENT_CURRENCY_NOT_ENABLED,
  type PaymentMethodSettlementConfig,
} from "@/domain/settlement/types";

/**
 * BR-006: settlement currency must be enabled for the selected payment method/company.
 * Later payment flows must call this before creating a charge/checkout.
 */
export function assertSettlementCurrencyEnabled(
  method: PaymentMethodSettlementConfig | null | undefined,
  settlementCurrencyCode: string,
): { ok: true } | { ok: false; error: typeof SETTLEMENT_CURRENCY_NOT_ENABLED } {
  const code = settlementCurrencyCode.trim().toUpperCase();
  if (!method || !method.methodEnabled) {
    return { ok: false, error: SETTLEMENT_CURRENCY_NOT_ENABLED };
  }
  if (!method.enabledSettlementCurrencyCodes.includes(code)) {
    return { ok: false, error: SETTLEMENT_CURRENCY_NOT_ENABLED };
  }
  return { ok: true };
}

import type { FixedConversionRateRecord } from "@/domain/fixed-rates/types";
import type { PaymentAdjustmentRecord } from "@/domain/payments/adjustments";
import type { PaymentRecord } from "@/domain/payments/types";

export const GBP_USD_RATE_V1 = "1.250000000000";
export const GBP_USD_RATE_V2 = "1.280000000000";

export function fixedRateRecord(
  overrides: Partial<FixedConversionRateRecord> &
    Pick<
      FixedConversionRateRecord,
      "id" | "fixedRate" | "versionNo" | "validFrom" | "validTo" | "status"
    >,
): FixedConversionRateRecord {
  return {
    fromCurrency: "GBP",
    toCurrency: "USD",
    frequencyLabel: "MANUAL",
    notes: null,
    createdByUserId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

export const gbpUsdRateV1 = fixedRateRecord({
  id: "rate-gbp-usd-v1",
  fixedRate: GBP_USD_RATE_V1,
  versionNo: 1,
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
  validTo: new Date("2026-07-01T00:00:00.000Z"),
  status: "EXPIRED",
});

export const gbpUsdRateV2 = fixedRateRecord({
  id: "rate-gbp-usd-v2",
  fixedRate: GBP_USD_RATE_V2,
  versionNo: 2,
  validFrom: new Date("2026-07-01T00:00:00.000Z"),
  validTo: null,
  status: "ACTIVE",
});

export function crossCurrencyPayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  const paymentDate = new Date("2026-03-15T00:00:00.000Z");
  return {
    id: "00000000-0000-4000-8000-000000000094",
    companyId: "11111111-1111-4111-8111-111111111111",
    invoiceId: "22222222-2222-4222-8222-222222222222",
    customerId: "33333333-3333-4333-8333-333333333333",
    methodCode: "MANUAL",
    externalTransactionId: "E2E-13-TXN",
    status: "SUCCESSFUL",
    complianceStatus: "NOT_REVIEWED",
    invoiceCurrencyCode: "GBP",
    invoiceAmountApplied: "100.00",
    settlementCurrencyCode: "USD",
    fixedConversionRate: GBP_USD_RATE_V1,
    rateVersionId: gbpUsdRateV1.id,
    rateSource: "ADMIN_FIXED_RATE",
    rateEffectiveAt: gbpUsdRateV1.validFrom,
    convertedSettlementAmount: "125.00",
    processorFeeAmount: "9.99",
    actualReceivedAmount: null,
    paymentDate,
    receivedAt: paymentDate,
    source: "MANUAL",
    notes: null,
    createdByUserId: null,
    confirmedByUserId: null,
    createdAt: paymentDate,
    updatedAt: paymentDate,
    ...overrides,
  };
}

export function adjustmentRow(
  overrides: Partial<PaymentAdjustmentRecord> &
    Pick<PaymentAdjustmentRecord, "type" | "status" | "amount">,
): Pick<
  PaymentAdjustmentRecord,
  "type" | "status" | "amount" | "invoiceAmount" | "settlementAmount"
> {
  return {
    invoiceAmount: overrides.amount,
    settlementAmount: overrides.amount,
    ...overrides,
  };
}

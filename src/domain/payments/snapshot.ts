import { normalizeCurrencyCode } from "@/domain/money";
import type { PaymentRateSource, PaymentRecord } from "@/domain/payments/types";

/**
 * Settlement conversion snapshot fields (Currency and Conversion §6.3 / TASK-046).
 * Locked when the payment is SUCCESSFUL (BR-020 / BR-021).
 */
export const PAYMENT_CONVERSION_SNAPSHOT_FIELDS = [
  "invoiceCurrencyCode",
  "invoiceAmountApplied",
  "settlementCurrencyCode",
  "fixedConversionRate",
  "rateSource",
  "rateEffectiveAt",
  "rateVersionId",
  "convertedSettlementAmount",
] as const;

export type PaymentConversionSnapshotField = (typeof PAYMENT_CONVERSION_SNAPSHOT_FIELDS)[number];

export function isCrossCurrencyPayment(
  payment: Pick<PaymentRecord, "invoiceCurrencyCode" | "settlementCurrencyCode">,
): boolean {
  return (
    normalizeCurrencyCode(payment.invoiceCurrencyCode) !==
    normalizeCurrencyCode(payment.settlementCurrencyCode)
  );
}

/** True when confirm must not re-resolve Admin rates (BR-021). */
export function isConversionSnapshotComplete(
  payment: Pick<PaymentRecord, "rateSource" | "rateEffectiveAt" | "rateVersionId">,
): boolean {
  if (payment.rateEffectiveAt == null) {
    return false;
  }
  if (payment.rateSource === "SAME_CURRENCY") {
    return true;
  }
  return payment.rateVersionId != null;
}

/**
 * Effective timestamp of the Admin rate version used, or payment date for same-currency 1.0.
 */
export function snapshotRateEffectiveAt(input: {
  readonly rateSource: PaymentRateSource;
  readonly paymentDate: Date;
  readonly rateValidFrom: Date | null;
}): Date {
  if (input.rateSource === "SAME_CURRENCY") {
    return input.paymentDate;
  }
  return input.rateValidFrom ?? input.paymentDate;
}

export type ConfirmSnapshotLock = {
  readonly rateEffectiveAt: Date;
  readonly rateVersionId: string | null;
};

/**
 * Values written on confirm to complete the snapshot lock.
 * Never replaces a stored fixed rate, converted amount, or existing version id.
 */
export function confirmSnapshotLock(
  payment: PaymentRecord,
  fill: ConfirmSnapshotLock,
): ConfirmSnapshotLock {
  return {
    rateVersionId: payment.rateVersionId ?? fill.rateVersionId,
    rateEffectiveAt: payment.rateEffectiveAt ?? fill.rateEffectiveAt,
  };
}

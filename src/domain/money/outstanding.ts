import { moneyDecimal, normalizeCurrencyCode, toDecimalString } from "@/domain/money/decimal";
import { sumMoney } from "@/domain/money/convert";
import { isWithinRoundingTolerance, roundMoney } from "@/domain/money/round";
import { MONEY_MIXED_CURRENCY, type DecimalInput, type MonetaryValue } from "@/domain/money/types";

export type InvoiceOutstandingInput = {
  readonly invoiceTotal: DecimalInput;
  readonly invoiceCurrencyCode: string;
  /** Confirmed payment applications in invoice currency only. */
  readonly confirmedApplications: readonly DecimalInput[];
  readonly decimalPrecision: number;
  /** Optional system-settings tolerance for zero-balance checks. */
  readonly roundingTolerance?: DecimalInput;
  /**
   * Optional merchant/processor fee (reconciliation only).
   * Must never affect invoice outstanding (BR-020).
   */
  readonly processorFee?: DecimalInput | null;
  /**
   * Optional actual received (reconciliation only).
   * Must never be subtracted from outstanding and is not an application.
   */
  readonly actualReceivedAmount?: DecimalInput | null;
};

/**
 * invoice_outstanding = invoice_total − sum(confirmed payment applications in invoice currency)
 * (BR-009 — not a manually edited paid total.)
 * Merchant fee and actual received are excluded (BR-020).
 */
export function computeInvoiceOutstanding(input: InvoiceOutstandingInput): MonetaryValue & {
  readonly isSettledWithinTolerance: boolean;
} {
  // Deliberately ignore reconciliation fields — they must never change balance.
  void input.processorFee;
  void input.actualReceivedAmount;

  const currencyCode = normalizeCurrencyCode(input.invoiceCurrencyCode);
  const applied = sumMoney(input.confirmedApplications);
  const outstanding = roundMoney(
    moneyDecimal(input.invoiceTotal).minus(applied),
    input.decimalPrecision,
  );
  const tolerance = input.roundingTolerance ?? "0";
  const settled = isWithinRoundingTolerance(outstanding, "0", tolerance);

  return {
    amount: toDecimalString(outstanding),
    currencyCode,
    isSettledWithinTolerance: settled,
  };
}

/**
 * Guard for BR-013: refuse unlabeled mixed-currency aggregation.
 */
export function assertSameCurrencyCodes(currencyCodes: readonly string[]): string {
  if (currencyCodes.length === 0) {
    throw new Error(MONEY_MIXED_CURRENCY);
  }
  const normalized = currencyCodes.map(normalizeCurrencyCode);
  const first = normalized[0]!;
  if (normalized.some((code) => code !== first)) {
    throw new Error(MONEY_MIXED_CURRENCY);
  }
  return first;
}

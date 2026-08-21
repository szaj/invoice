import {
  computeInvoiceOutstanding,
  moneyDecimal,
  roundMoney,
  sumMoney,
  toDecimalString,
} from "@/domain/money";
import type { DecimalInput } from "@/domain/money/types";

export const INVOICE_DISCOUNT_TOTAL_BLOCKED =
  "Invoice discounts are not available until the discount model is accepted (ADR-010).";

export type InvoiceLineForTotals = {
  readonly lineTotal: DecimalInput;
  readonly taxRatePercent: DecimalInput | null;
};

export type InvoiceTotalsResult = {
  readonly currencyCode: string;
  readonly subtotal: string;
  /** Always 0 while ADR-010 remains OPEN — not a client-editable paid/discount field. */
  readonly discountTotal: string;
  readonly taxTotal: string;
  readonly invoiceTotal: string;
  /** Sum of confirmed payment applications (BR-009). Zero until payments exist. */
  readonly confirmedPaidAmount: string;
  readonly outstandingAmount: string;
  readonly isSettledWithinTolerance: boolean;
};

/**
 * Authoritative invoice totals (TASK-034 / Invoices §8.4 / BR-009).
 *
 * - subtotal = sum(line_total)
 * - discountTotal = 0 while ADR-010 is OPEN (no discount model invented)
 * - taxTotal = sum(round(line_total × tax_rate_percent / 100)) for lines with a tax snapshot
 * - invoiceTotal = round(subtotal − discountTotal + taxTotal)
 * - confirmedPaidAmount = sum(confirmed applications); never a manually edited paid total
 * - outstandingAmount = invoiceTotal − confirmedPaidAmount
 */
export function computeInvoiceTotals(input: {
  readonly currencyCode: string;
  readonly decimalPrecision: number;
  readonly lineItems: readonly InvoiceLineForTotals[];
  readonly confirmedApplications?: readonly DecimalInput[];
  readonly roundingTolerance?: DecimalInput;
}): InvoiceTotalsResult {
  const precision = input.decimalPrecision;
  const currencyCode = input.currencyCode.trim().toUpperCase();

  const subtotal = roundMoney(sumMoney(input.lineItems.map((item) => item.lineTotal)), precision);

  // ADR-010 OPEN: do not invent a discount model; discount total is always zero.
  const discountTotal = moneyDecimal("0");

  const taxParts = input.lineItems.map((item) => {
    if (item.taxRatePercent == null || item.taxRatePercent === "") {
      return moneyDecimal("0");
    }
    const rate = moneyDecimal(item.taxRatePercent);
    if (rate.isNeg()) {
      throw new Error("Tax rate percent must be non-negative.");
    }
    return roundMoney(moneyDecimal(item.lineTotal).times(rate).div(100), precision);
  });
  const taxTotal = roundMoney(sumMoney(taxParts.map((part) => toDecimalString(part))), precision);

  const invoiceTotal = roundMoney(subtotal.minus(discountTotal).plus(taxTotal), precision);

  const applications = input.confirmedApplications ?? [];
  const confirmedPaid = roundMoney(sumMoney(applications), precision);
  const outstanding = computeInvoiceOutstanding({
    invoiceTotal: toDecimalString(invoiceTotal),
    invoiceCurrencyCode: currencyCode,
    confirmedApplications: applications,
    decimalPrecision: precision,
    roundingTolerance: input.roundingTolerance,
  });

  return {
    currencyCode,
    subtotal: toDecimalString(subtotal),
    discountTotal: toDecimalString(discountTotal),
    taxTotal: toDecimalString(taxTotal),
    invoiceTotal: toDecimalString(invoiceTotal),
    confirmedPaidAmount: toDecimalString(confirmedPaid),
    outstandingAmount: outstanding.amount,
    isSettledWithinTolerance: outstanding.isSettledWithinTolerance,
  };
}

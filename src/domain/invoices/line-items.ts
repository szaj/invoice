import { moneyDecimal, roundMoney, toDecimalString } from "@/domain/money";
import type { DecimalInput } from "@/domain/money/types";

export const INVOICE_LINE_DESCRIPTION_REQUIRED = "Line description is required.";
export const INVOICE_LINE_QUANTITY_INVALID = "Line quantity must be a decimal greater than zero.";
export const INVOICE_LINE_UNIT_RATE_INVALID = "Line unit rate must be a valid money amount.";
export const INVOICE_LINE_TAX_RATE_INVALID =
  "Tax rate percent must be a non-negative decimal when provided.";
export const INVOICE_LINE_DISCOUNT_BLOCKED =
  "Line discounts are not available until the discount model is accepted (ADR-010).";

/**
 * Authoritative line total (TASK-033): round(quantity × unitRate) at invoice currency precision.
 * Tax snapshot is stored separately; invoice-level tax aggregation is TASK-034.
 * Discount is intentionally excluded while ADR-010 remains OPEN.
 */
export function computeInvoiceLineTotal(input: {
  readonly quantity: DecimalInput;
  readonly unitRate: DecimalInput;
  readonly decimalPrecision: number;
}): string {
  const quantity = moneyDecimal(input.quantity);
  if (quantity.lte(0)) {
    throw new Error(INVOICE_LINE_QUANTITY_INVALID);
  }
  const unitRate = moneyDecimal(input.unitRate);
  if (unitRate.isNeg()) {
    throw new Error(INVOICE_LINE_UNIT_RATE_INVALID);
  }
  const product = quantity.times(unitRate);
  return toDecimalString(roundMoney(product, input.decimalPrecision));
}

export type InvoiceLineItemRecord = {
  readonly id: string;
  readonly invoiceId: string;
  readonly sortOrder: number;
  readonly description: string;
  readonly quantity: string;
  readonly unitRate: string;
  readonly taxName: string | null;
  readonly taxRatePercent: string | null;
  readonly lineTotal: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

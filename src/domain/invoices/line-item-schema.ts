import { z } from "zod";

import { moneyDecimal } from "@/domain/money";
import {
  INVOICE_LINE_DESCRIPTION_REQUIRED,
  INVOICE_LINE_QUANTITY_INVALID,
  INVOICE_LINE_TAX_RATE_INVALID,
  INVOICE_LINE_UNIT_RATE_INVALID,
} from "@/domain/invoices/line-items";

function blankToNull(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const decimalStringSchema = (invalidMessage: string) =>
  z.preprocess(
    (value) => {
      if (typeof value === "number") {
        // Reject JS float leakage; clients must send decimal strings.
        return value;
      }
      if (typeof value === "string") {
        return value.trim();
      }
      return value;
    },
    z.string({ error: invalidMessage }).regex(/^-?\d+(\.\d+)?$/, invalidMessage),
  );

/**
 * Client write shape for a draft line item. lineTotal is server-calculated (never trusted).
 * Discount fields are omitted while ADR-010 is OPEN (strictObject rejects unknown keys).
 */
export const invoiceLineItemWriteSchema = z
  .strictObject({
    description: z
      .string({ error: INVOICE_LINE_DESCRIPTION_REQUIRED })
      .trim()
      .min(1, INVOICE_LINE_DESCRIPTION_REQUIRED)
      .max(2000),
    quantity: decimalStringSchema(INVOICE_LINE_QUANTITY_INVALID).default("1"),
    unitRate: decimalStringSchema(INVOICE_LINE_UNIT_RATE_INVALID),
    taxName: z.preprocess(blankToNull, z.string().trim().max(200).nullable()),
    taxRatePercent: z.preprocess(
      blankToNull,
      z
        .string()
        .regex(/^\d+(\.\d+)?$/, INVOICE_LINE_TAX_RATE_INVALID)
        .nullable(),
    ),
  })
  .superRefine((value, ctx) => {
    try {
      if (moneyDecimal(value.quantity).lte(0)) {
        ctx.addIssue({
          code: "custom",
          message: INVOICE_LINE_QUANTITY_INVALID,
          path: ["quantity"],
        });
      }
    } catch {
      ctx.addIssue({
        code: "custom",
        message: INVOICE_LINE_QUANTITY_INVALID,
        path: ["quantity"],
      });
    }
    try {
      if (moneyDecimal(value.unitRate).isNeg()) {
        ctx.addIssue({
          code: "custom",
          message: INVOICE_LINE_UNIT_RATE_INVALID,
          path: ["unitRate"],
        });
      }
    } catch {
      ctx.addIssue({
        code: "custom",
        message: INVOICE_LINE_UNIT_RATE_INVALID,
        path: ["unitRate"],
      });
    }
    if (value.taxRatePercent != null) {
      try {
        if (moneyDecimal(value.taxRatePercent).isNeg()) {
          ctx.addIssue({
            code: "custom",
            message: INVOICE_LINE_TAX_RATE_INVALID,
            path: ["taxRatePercent"],
          });
        }
      } catch {
        ctx.addIssue({
          code: "custom",
          message: INVOICE_LINE_TAX_RATE_INVALID,
          path: ["taxRatePercent"],
        });
      }
    }
  });

export type InvoiceLineItemWriteInput = z.output<typeof invoiceLineItemWriteSchema>;
export type InvoiceLineItemWriteFormValues = z.input<typeof invoiceLineItemWriteSchema>;

export const invoiceLineItemsReplaceSchema = z.strictObject({
  lineItems: z.array(invoiceLineItemWriteSchema).max(500),
});

export type InvoiceLineItemsReplaceInput = z.output<typeof invoiceLineItemsReplaceSchema>;

import { z } from "zod";

import { PAYMENT_INVALID_INPUT, PAYMENT_JS_NUMBER_FORBIDDEN } from "@/domain/payments/types";

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

const nullableText = (max: number) => z.preprocess(blankToNull, z.string().max(max).nullable());

const JS_NUMBER_SENTINEL = "__JS_NUMBER__";

/** Optional merchant actual settlement amount (BR-025). Reject JS numbers (ADR-004). */
const optionalActualSettlementAmountSchema = z.preprocess(
  (value) => {
    if (typeof value === "number") {
      return JS_NUMBER_SENTINEL;
    }
    return blankToNull(value);
  },
  z
    .string()
    .nullable()
    .superRefine((value, ctx) => {
      if (value === null) {
        return;
      }
      if (value === JS_NUMBER_SENTINEL) {
        ctx.addIssue({ code: "custom", message: PAYMENT_JS_NUMBER_FORBIDDEN });
        return;
      }
      if (!/^-?\d+(\.\d+)?$/.test(value)) {
        ctx.addIssue({ code: "custom", message: PAYMENT_INVALID_INPUT });
      }
    }),
);

const optionalEffectiveDateSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}T00:00:00.000Z`);
    }
    return new Date(trimmed);
  }
  return value;
}, z.date().optional());

/**
 * Record/process full refund input (TASK-064).
 * Invoice amount is always the original payment applied amount — never from the client.
 * Settlement uses merchant actual when provided, else the payment snapshot (BR-025).
 */
export const fullRefundSchema = z.strictObject({
  reason: nullableText(2000).optional(),
  merchantReference: nullableText(200).optional(),
  notes: nullableText(4000).optional(),
  effectiveDate: optionalEffectiveDateSchema,
  /** Merchant-provided actual settlement debit/refund amount when known (BR-025). */
  actualSettlementAmount: optionalActualSettlementAmountSchema.optional(),
});

export type FullRefundInput = z.output<typeof fullRefundSchema>;

/**
 * Record/process partial refund input (TASK-065).
 * invoiceAmount is required (invoice-currency portion). Settlement uses merchant actual
 * when provided, else original payment fixed-rate snapshot × invoiceAmount (BR-025).
 */
export const partialRefundSchema = z.strictObject({
  invoiceAmount: z.preprocess(
    (value) => {
      if (typeof value === "number") {
        return JS_NUMBER_SENTINEL;
      }
      if (typeof value === "string") {
        return value.trim();
      }
      return value;
    },
    z.string({ error: PAYMENT_INVALID_INPUT }).superRefine((value, ctx) => {
      if (value === JS_NUMBER_SENTINEL) {
        ctx.addIssue({ code: "custom", message: PAYMENT_JS_NUMBER_FORBIDDEN });
        return;
      }
      if (!/^-?\d+(\.\d+)?$/.test(value)) {
        ctx.addIssue({ code: "custom", message: PAYMENT_INVALID_INPUT });
      }
    }),
  ),
  reason: nullableText(2000).optional(),
  merchantReference: nullableText(200).optional(),
  notes: nullableText(4000).optional(),
  effectiveDate: optionalEffectiveDateSchema,
  /** Merchant-provided actual settlement debit/refund amount when known (BR-025). */
  actualSettlementAmount: optionalActualSettlementAmountSchema.optional(),
});

export type PartialRefundInput = z.output<typeof partialRefundSchema>;

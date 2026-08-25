import { z } from "zod";

import { ADJUSTMENT_NOTE_BODY_REQUIRED } from "@/domain/payments/adjustment-history";
import { paymentIdSchema } from "@/domain/payments/schema";

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

/**
 * Add Adjustment Note input (TASK-068).
 * Reason maps to Refund/Chargeback Settings reason-code field (free text until settings catalog).
 * Merchant reference maps to merchant case/reference settings field.
 * Attachments metadata omitted until evidence requirements are enabled.
 */
export const adjustmentNoteCreateSchema = z.strictObject({
  notes: z
    .string({ error: ADJUSTMENT_NOTE_BODY_REQUIRED })
    .trim()
    .min(1, ADJUSTMENT_NOTE_BODY_REQUIRED)
    .max(4000),
  reason: nullableText(2000).optional(),
  merchantReference: nullableText(200).optional(),
});

export type AdjustmentNoteCreateInput = z.output<typeof adjustmentNoteCreateSchema>;

/** Cancel adjustment input — reason retained on audit; history row is never deleted. */
export const adjustmentCancelSchema = z.strictObject({
  reason: nullableText(2000).optional(),
  notes: nullableText(4000).optional(),
});

export type AdjustmentCancelInput = z.output<typeof adjustmentCancelSchema>;

export const paymentAdjustmentIdSchema = paymentIdSchema;

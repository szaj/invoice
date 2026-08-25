import { z } from "zod";

import { DISPUTE_OPEN_STATUSES } from "@/domain/payments/adjustments";

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
 * Mark-as-dispute input (TASK-063). Amounts come from the original payment — never from the client.
 */
export const disputeOpenSchema = z.strictObject({
  status: z.enum(DISPUTE_OPEN_STATUSES).optional(),
  reason: nullableText(2000).optional(),
  merchantReference: nullableText(200).optional(),
  notes: nullableText(4000).optional(),
});

export type DisputeOpenInput = z.output<typeof disputeOpenSchema>;

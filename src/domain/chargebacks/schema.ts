import { z } from "zod";

import {
  CHARGEBACK_DEBIT_LOSS_STATUSES,
  CHARGEBACK_WON_REVERSAL_STATUSES,
} from "@/domain/payments/adjustments";
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

/** Optional merchant actual settlement debit amount (BR-025). Reject JS numbers (ADR-004). */
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
 * Record Chargeback Debit/Loss input (TASK-066).
 * Invoice amount is the original payment applied amount — never from the client.
 * Settlement uses merchant actual when provided, else the payment snapshot (BR-025).
 */
export const chargebackDebitLossSchema = z.strictObject({
  status: z.enum(CHARGEBACK_DEBIT_LOSS_STATUSES).optional(),
  reason: nullableText(2000).optional(),
  merchantReference: nullableText(200).optional(),
  notes: nullableText(4000).optional(),
  effectiveDate: optionalEffectiveDateSchema,
  /** Merchant-provided actual settlement debit amount when known (BR-025). */
  actualSettlementAmount: optionalActualSettlementAmountSchema.optional(),
});

export type ChargebackDebitLossInput = z.output<typeof chargebackDebitLossSchema>;

/**
 * Record Chargeback Won/Reversal input (TASK-067).
 * Amounts default from the prior debit/loss row — never from the client invoice figure.
 * Settlement uses merchant actual when provided, else the debit settlement (BR-025).
 * Does not edit the original payment or debit row (BR-023 / E2E-16).
 */
export const chargebackWonReversalSchema = z.strictObject({
  status: z.enum(CHARGEBACK_WON_REVERSAL_STATUSES).optional(),
  reason: nullableText(2000).optional(),
  merchantReference: nullableText(200).optional(),
  notes: nullableText(4000).optional(),
  effectiveDate: optionalEffectiveDateSchema,
  /** Merchant-provided actual settlement credit amount when known (BR-025). */
  actualSettlementAmount: optionalActualSettlementAmountSchema.optional(),
});

export type ChargebackWonReversalInput = z.output<typeof chargebackWonReversalSchema>;

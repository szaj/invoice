import { z } from "zod";

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
const nullableUuid = z.preprocess(blankToNull, z.uuid().nullable());

/**
 * Non-financial metadata only (Invoices §8.6 / TASK-037).
 * Does not include financial fields — those stay blocked while ADR-009 is OPEN.
 * Compliance status is not writable here — use compliance.review APIs (TASK-071).
 */
export const issuedInvoiceMetadataWriteSchema = z.strictObject({
  referencePo: nullableText(200),
  assignedStaffUserId: nullableUuid,
  internalNotes: nullableText(5000),
  customerNotes: nullableText(5000),
});

export type IssuedInvoiceMetadataWriteInput = z.output<typeof issuedInvoiceMetadataWriteSchema>;
export type IssuedInvoiceMetadataWriteFormValues = z.input<typeof issuedInvoiceMetadataWriteSchema>;

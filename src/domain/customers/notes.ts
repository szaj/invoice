export type CustomerNoteVisibility = "INTERNAL";

/**
 * Internal-only customer note (Customers §7.2 / TASK-027).
 * Never portal-visible. Never included on PDF/email payloads.
 */
export type CustomerNoteRecord = {
  readonly id: string;
  readonly customerId: string;
  readonly authorUserId: string;
  readonly authorName: string | null;
  readonly body: string;
  readonly visibility: CustomerNoteVisibility;
  readonly createdAt: Date;
};

export const CUSTOMER_NOTE_INVALID_INPUT = "Check the note and try again.";
export const CUSTOMER_NOTE_UNAVAILABLE = "Customer notes are temporarily unavailable.";
export const CUSTOMER_NOTE_INTERNAL_ONLY = "INTERNAL" as const;

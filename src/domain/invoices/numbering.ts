/**
 * Invoice number formatting and allocation helpers (TASK-035 / BR-003).
 * Sequences are per-company; numbers are never reused. Year component is optional via settings.
 */

export const INVOICE_NUMBER_PREFIX_REQUIRED =
  "Set a company invoice prefix before allocating invoice numbers.";
export const INVOICE_NUMBER_ALREADY_ASSIGNED = "This invoice already has a number.";
export const INVOICE_NUMBER_COLLISION =
  "That invoice number is already used for this company and cannot be reused.";
export const INVOICE_NUMBER_HAND_EDIT_FORBIDDEN =
  "Invoice numbers are system-generated and cannot be set manually.";

export const INVOICE_SEQUENCE_PAD_WIDTH = 6;

export type FormatInvoiceNumberInput = {
  readonly prefix: string;
  readonly sequence: number;
  /** Calendar year when include-year setting is enabled; otherwise omit. */
  readonly year?: number | null;
};

/**
 * Format: `{prefix}{NNNNNN}` or `{prefix}{YYYY}-{NNNNNN}` when year is provided.
 * Prefix is taken from company branding (e.g. VX-). Sequence is never reused.
 */
export function formatInvoiceNumber(input: FormatInvoiceNumberInput): string {
  const prefix = input.prefix.trim();
  if (prefix.length === 0) {
    throw new Error(INVOICE_NUMBER_PREFIX_REQUIRED);
  }
  if (!Number.isInteger(input.sequence) || input.sequence < 1) {
    throw new Error("Invoice sequence must be a positive integer.");
  }
  const padded = String(input.sequence).padStart(INVOICE_SEQUENCE_PAD_WIDTH, "0");
  if (input.year != null) {
    if (!Number.isInteger(input.year) || input.year < 1000 || input.year > 9999) {
      throw new Error("Invoice year component must be a four-digit year.");
    }
    return `${prefix}${input.year}-${padded}`;
  }
  return `${prefix}${padded}`;
}

/** Year for optional number component using the system default timezone calendar date. */
export function invoiceNumberYearForTimezone(timeZone: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
  }).formatToParts(at);
  const yearPart = parts.find((part) => part.type === "year")?.value;
  const year = yearPart ? Number.parseInt(yearPart, 10) : at.getUTCFullYear();
  if (!Number.isFinite(year)) {
    return at.getUTCFullYear();
  }
  return year;
}

/** Reject client attempts to set invoice numbers manually (BR-003). */
export function rejectHandEditedInvoiceNumber(
  input: unknown,
): { ok: false; status: 400; error: string } | null {
  if (input && typeof input === "object" && "invoiceNumber" in input) {
    const value = (input as { invoiceNumber?: unknown }).invoiceNumber;
    if (value != null && value !== "") {
      return { ok: false, status: 400, error: INVOICE_NUMBER_HAND_EDIT_FORBIDDEN };
    }
  }
  return null;
}

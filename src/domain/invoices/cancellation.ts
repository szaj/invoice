import { z } from "zod";

import type { InvoiceStatus } from "@/domain/invoices/types";

/**
 * Invoice cancellation (TASK-038 / BR-012 / BR-019).
 * Soft status only — no hard delete, no silent rewrite of financial totals or versions.
 */

export const INVOICE_CANCEL_REASON_REQUIRED = "A cancellation reason is required.";
export const INVOICE_NOT_CANCELLABLE = "This invoice cannot be cancelled in its current status.";
export const INVOICE_ALREADY_CANCELLED = "This invoice is already cancelled.";
export const INVOICE_CANCEL_FORBIDDEN = "You cannot cancel invoices.";

/**
 * Allowed sources per Invoices §8.1 state table (TASK-038).
 * Partially Paid / Paid are not cancellable here (payment workflows later).
 */
export const CANCELLABLE_INVOICE_STATUSES = ["DRAFT", "ISSUED", "OVERDUE"] as const;

export type CancellableInvoiceStatus = (typeof CANCELLABLE_INVOICE_STATUSES)[number];

export function canCancelInvoiceStatus(status: InvoiceStatus): boolean {
  return (CANCELLABLE_INVOICE_STATUSES as readonly string[]).includes(status);
}

export const invoiceCancelReasonSchema = z
  .string()
  .trim()
  .min(1, INVOICE_CANCEL_REASON_REQUIRED)
  .max(2000);

export const invoiceCancelInputSchema = z.strictObject({
  reason: invoiceCancelReasonSchema,
});

export type InvoiceCancelInput = z.output<typeof invoiceCancelInputSchema>;

/** BR-019: cancelled invoices are not collectible outstanding. */
export function isCollectibleInvoiceStatus(status: InvoiceStatus): boolean {
  return status !== "CANCELLED" && status !== "DRAFT";
}

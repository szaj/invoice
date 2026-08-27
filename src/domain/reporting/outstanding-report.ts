import { isCollectibleInvoiceStatus } from "@/domain/invoices/cancellation";
import type { InvoiceStatus } from "@/domain/invoices/types";
import { moneyDecimal } from "@/domain/money/decimal";
import type { OutstandingReportRow } from "@/domain/reporting/types";

/**
 * Outstanding Report domain helpers (TASK-080 / §13.3 / BR-009 / BR-019).
 * Collectible open balances only — cancelled (and draft) excluded by default.
 * Outstanding amounts are the stored confirmed-application balances (BR-009).
 */

function toUtcDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/**
 * Days past due date (UTC date-only). Not yet due → 0.
 * Used as the report "age" column; overdue aging buckets come in TASK-081.
 */
export function computeOutstandingAgeDays(dueDate: Date, asOf: Date = new Date()): number {
  const due = toUtcDateOnly(dueDate);
  const today = toUtcDateOnly(asOf);
  const diffMs = today.getTime() - due.getTime();
  if (diffMs <= 0) {
    return 0;
  }
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Collectible open outstanding: not cancelled/draft (BR-019) and balance > 0.
 * Outstanding must be the stored confirmed-application balance (BR-009).
 */
export function isOutstandingReportEligible(invoice: {
  readonly status: InvoiceStatus;
  readonly outstandingAmount: string;
}): boolean {
  if (!isCollectibleInvoiceStatus(invoice.status)) {
    return false;
  }
  return moneyDecimal(invoice.outstandingAmount).gt(0);
}

/**
 * Pure row filter for unit tests and defensive service post-checks.
 * Cancelled invoices are never collectible outstanding by default (BR-019).
 */
export function filterOutstandingReportEligibleRows<
  T extends {
    readonly status: InvoiceStatus;
    readonly outstandingAmount: string;
  },
>(rows: readonly T[]): readonly T[] {
  return rows.filter((row) => isOutstandingReportEligible(row));
}

/**
 * BR-009: report rows must expose stored outstanding, not a client-edited paid total.
 */
export function assertOutstandingReportUsesStoredBalance(
  rows: readonly OutstandingReportRow[],
): void {
  for (const row of rows) {
    if (row.outstandingAmount == null || String(row.outstandingAmount).trim().length === 0) {
      throw new Error("Outstanding report row missing stored outstanding amount.");
    }
    if (!moneyDecimal(row.outstandingAmount).gt(0)) {
      throw new Error("Outstanding report row must have open balance greater than zero.");
    }
    if (row.status === "CANCELLED" || row.status === "DRAFT") {
      throw new Error("Outstanding report must not include cancelled or draft invoices (BR-019).");
    }
  }
}

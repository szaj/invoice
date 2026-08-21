import { moneyDecimal } from "@/domain/money/decimal";
import type { InvoiceStatus } from "@/domain/invoices/types";

/**
 * Invoice lifecycle transitions.
 * TASK-036: issue + overdue. TASK-038: cancel (Draft/Issued/Overdue → Cancelled).
 * Paid/partial → payment tasks. Issued financial edits → ADR-009 OPEN.
 */

export const INVOICE_ILLEGAL_TRANSITION = "That status change is not allowed.";
export const INVOICE_NOT_ISSUABLE = "Only draft invoices can be issued.";
export const INVOICE_ALREADY_ISSUED = "This invoice is already issued.";
export const INVOICE_DUE_DATE_REQUIRED =
  "A due date is required to issue an invoice (due-on-receipt policy is not enabled).";
export const INVOICE_ISSUE_FORBIDDEN = "You cannot issue this invoice.";

/** Statuses that can become OVERDUE when BR-018 conditions hold. */
export const OVERDUE_ELIGIBLE_STATUSES = ["ISSUED", "PARTIALLY_PAID"] as const;

export type OverdueEligibleStatus = (typeof OVERDUE_ELIGIBLE_STATUSES)[number];

/**
 * Transitions implemented through TASK-036 + TASK-038.
 * Payment-driven transitions remain omitted.
 */
const LIFECYCLE_TRANSITIONS: ReadonlyMap<InvoiceStatus, ReadonlySet<InvoiceStatus>> = new Map<
  InvoiceStatus,
  ReadonlySet<InvoiceStatus>
>([
  ["DRAFT", new Set<InvoiceStatus>(["ISSUED", "CANCELLED"])],
  ["ISSUED", new Set<InvoiceStatus>(["OVERDUE", "CANCELLED"])],
  ["PARTIALLY_PAID", new Set<InvoiceStatus>(["OVERDUE"])],
  ["OVERDUE", new Set<InvoiceStatus>(["CANCELLED"])],
]);

export function canTransitionInvoiceStatus(from: InvoiceStatus, to: InvoiceStatus): boolean {
  if (from === to) {
    return true;
  }
  return LIFECYCLE_TRANSITIONS.get(from)?.has(to) === true;
}

export function assertInvoiceTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (!canTransitionInvoiceStatus(from, to)) {
    throw new Error(INVOICE_ILLEGAL_TRANSITION);
  }
}

function toUtcDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/**
 * BR-018: Overdue applies only to issued/sent/partial invoices with balance > 0
 * and due date in the past (date comparison in UTC).
 */
export function invoiceMeetsOverdueRule(
  invoice: {
    readonly status: InvoiceStatus;
    readonly dueDate: Date;
    readonly outstandingAmount: string;
  },
  asOf: Date = new Date(),
): boolean {
  if (
    invoice.status !== "ISSUED" &&
    invoice.status !== "PARTIALLY_PAID" &&
    invoice.status !== "OVERDUE"
  ) {
    return false;
  }
  if (!moneyDecimal(invoice.outstandingAmount).gt(0)) {
    return false;
  }
  const due = toUtcDateOnly(invoice.dueDate);
  const today = toUtcDateOnly(asOf);
  return due.getTime() < today.getTime();
}

/**
 * Next persisted status after overdue evaluation.
 * - Eligible + meets BR-018 → OVERDUE
 * - Already OVERDUE + still meets → OVERDUE
 * - Already OVERDUE + no longer meets (e.g. outstanding cleared later) → leave unchanged here
 *   (payment tasks own paid/partial reverse transitions)
 * - Does not meet → null (no change)
 */
export function evaluateOverdueStatus(
  invoice: {
    readonly status: InvoiceStatus;
    readonly dueDate: Date;
    readonly outstandingAmount: string;
  },
  asOf: Date = new Date(),
): InvoiceStatus | null {
  const meets = invoiceMeetsOverdueRule(invoice, asOf);
  if (invoice.status === "OVERDUE") {
    return meets ? "OVERDUE" : null;
  }
  if ((invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID") && meets) {
    return "OVERDUE";
  }
  return null;
}

export function isLifecycleListStatus(status: InvoiceStatus): boolean {
  return (
    status === "DRAFT" ||
    status === "ISSUED" ||
    status === "PARTIALLY_PAID" ||
    status === "PAID" ||
    status === "OVERDUE" ||
    status === "CANCELLED"
  );
}

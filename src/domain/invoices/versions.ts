import type { InvoiceLineItemRecord } from "@/domain/invoices/line-items";
import type { InvoiceRecord } from "@/domain/invoices/types";

/**
 * Immutable invoice version snapshot (TASK-037 / Data Model).
 * Captured on issue. Not a license to edit issued financial fields (ADR-009 OPEN).
 */

export const INVOICE_VERSION_REASON_ISSUED = "Issued";
export const INVOICE_ISSUED_FINANCIAL_EDIT_FORBIDDEN =
  "Issued invoice financial fields cannot be changed. Versions preserve history; financial revision policy is not decided (ADR-009).";
export const INVOICE_ISSUED_METADATA_FORBIDDEN = "You cannot edit issued invoice metadata.";
export const INVOICE_VERSION_NOT_FOUND = "Invoice version not found.";

export type InvoiceVersionSnapshotLineItem = {
  readonly sortOrder: number;
  readonly description: string;
  readonly quantity: string;
  readonly unitRate: string;
  readonly taxName: string | null;
  readonly taxRatePercent: string | null;
  readonly lineTotal: string;
};

export type InvoiceVersionSnapshot = {
  readonly invoiceId: string;
  readonly companyId: string;
  readonly customerId: string;
  readonly invoiceNumber: string | null;
  readonly invoiceDate: string;
  readonly dueDate: string;
  readonly currencyCode: string;
  readonly referencePo: string | null;
  readonly assignedStaffUserId: string | null;
  readonly status: string;
  readonly complianceStatus: string;
  readonly internalNotes: string | null;
  readonly customerNotes: string | null;
  readonly subtotal: string;
  readonly discountTotal: string;
  readonly taxTotal: string;
  readonly invoiceTotal: string;
  readonly confirmedPaidAmount: string;
  readonly outstandingAmount: string;
  readonly lineItems: readonly InvoiceVersionSnapshotLineItem[];
};

export type InvoiceVersionRecord = {
  readonly id: string;
  readonly invoiceId: string;
  readonly versionNo: number;
  readonly snapshot: InvoiceVersionSnapshot;
  readonly reason: string | null;
  readonly createdByUserId: string | null;
  readonly createdAt: Date;
};

function dateOnlyIso(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function buildInvoiceVersionSnapshot(
  invoice: InvoiceRecord,
  lineItems: readonly InvoiceLineItemRecord[],
): InvoiceVersionSnapshot {
  return {
    invoiceId: invoice.id,
    companyId: invoice.companyId,
    customerId: invoice.customerId,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: dateOnlyIso(invoice.invoiceDate),
    dueDate: dateOnlyIso(invoice.dueDate),
    currencyCode: invoice.currencyCode,
    referencePo: invoice.referencePo,
    assignedStaffUserId: invoice.assignedStaffUserId,
    status: invoice.status,
    complianceStatus: invoice.complianceStatus,
    internalNotes: invoice.internalNotes,
    customerNotes: invoice.customerNotes,
    subtotal: invoice.subtotal,
    discountTotal: invoice.discountTotal,
    taxTotal: invoice.taxTotal,
    invoiceTotal: invoice.invoiceTotal,
    confirmedPaidAmount: invoice.confirmedPaidAmount,
    outstandingAmount: invoice.outstandingAmount,
    lineItems: lineItems.map((item) => ({
      sortOrder: item.sortOrder,
      description: item.description,
      quantity: item.quantity,
      unitRate: item.unitRate,
      taxName: item.taxName,
      taxRatePercent: item.taxRatePercent,
      lineTotal: item.lineTotal,
    })),
  };
}

/** Keys that may be patched on issued invoices (non-financial metadata). */
export const ISSUED_INVOICE_METADATA_KEYS = [
  "referencePo",
  "assignedStaffUserId",
  "complianceStatus",
  "internalNotes",
  "customerNotes",
] as const;

export type IssuedInvoiceMetadataKey = (typeof ISSUED_INVOICE_METADATA_KEYS)[number];

/** Financial / identity keys that must not be patched on issued invoices. */
export const ISSUED_INVOICE_FINANCIAL_KEYS = [
  "companyId",
  "customerId",
  "invoiceNumber",
  "invoiceDate",
  "dueDate",
  "currencyCode",
  "status",
  "subtotal",
  "discountTotal",
  "taxTotal",
  "invoiceTotal",
  "confirmedPaidAmount",
  "outstandingAmount",
  "lineItems",
  "items",
] as const;

export function payloadContainsIssuedFinancialFields(input: unknown): boolean {
  if (!input || typeof input !== "object") {
    return false;
  }
  const keys = Object.keys(input as Record<string, unknown>);
  return keys.some((key) => (ISSUED_INVOICE_FINANCIAL_KEYS as readonly string[]).includes(key));
}

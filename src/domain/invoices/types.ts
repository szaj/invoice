import type { ComplianceStatus } from "@/domain/compliance/types";

export const INVOICE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export { COMPLIANCE_STATUSES as INVOICE_COMPLIANCE_STATUSES } from "@/domain/compliance/types";

export type InvoiceComplianceStatus = ComplianceStatus;

export const INVOICE_INVALID_INPUT = "Check the invoice details and try again.";
export const INVOICE_COMPANY_CUSTOMER_REQUIRED =
  "Every invoice requires exactly one company and one customer.";
export const INVOICE_CURRENCY_REQUIRED = "Invoice currency is required.";
export const INVOICE_NOT_FOUND = "Invoice not found.";
export const INVOICE_UNAVAILABLE = "Invoice management is temporarily unavailable.";
export const INVOICE_NOT_DRAFT = "Only draft invoices can be edited here.";
export const INVOICE_CUSTOMER_NOT_LINKED = "The customer must be linked to the invoice company.";
export const INVOICE_CUSTOMER_INACTIVE =
  "This customer is inactive. New invoices are blocked; history is preserved.";
export const INVOICE_DRAFT_EDIT_FORBIDDEN =
  "You can only edit draft invoices you created or are assigned to.";
export const INVOICE_ISSUED_EDIT_BLOCKED =
  "Issued invoice financial fields cannot be edited until the issued-edit policy is decided.";
export const INVOICE_DUPLICATE_FORBIDDEN = "You cannot duplicate this invoice.";
export const INVOICE_DUPLICATE_FAILED = "Invoice could not be duplicated.";
export const INVOICE_PRINT_PDF_REQUIRED =
  "A stored invoice PDF is required before print or export.";

/**
 * Invoice header record (Invoices §8.2 / TASK-030 + TASK-034 stored totals).
 * Payments/PDF/numbering lock are later tasks. Paid/outstanding are recalculated (BR-009),
 * never manually edited as source of truth. Cancellation is soft status (TASK-038).
 */
export type InvoiceRecord = {
  readonly id: string;
  readonly companyId: string;
  readonly customerId: string;
  readonly invoiceNumber: string | null;
  readonly invoiceDate: Date;
  readonly dueDate: Date;
  readonly currencyCode: string;
  readonly referencePo: string | null;
  readonly assignedStaffUserId: string | null;
  readonly status: InvoiceStatus;
  readonly complianceStatus: InvoiceComplianceStatus;
  readonly internalNotes: string | null;
  readonly customerNotes: string | null;
  readonly subtotal: string;
  readonly discountTotal: string;
  readonly taxTotal: string;
  readonly invoiceTotal: string;
  readonly confirmedPaidAmount: string;
  readonly outstandingAmount: string;
  readonly cancellationReason: string | null;
  readonly cancelledAt: Date | null;
  readonly cancelledByUserId: string | null;
  readonly createdByUserId: string | null;
  readonly updatedByUserId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

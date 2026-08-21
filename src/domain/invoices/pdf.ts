import type { InvoiceVersionSnapshot } from "@/domain/invoices/versions";

/**
 * Invoice PDF generation (TASK-039 / ADR-013).
 * Financial content comes from immutable invoice_versions snapshots.
 * Branding/customer identity are frozen into PDF bytes at first generation.
 * Internal notes must never appear on the PDF.
 */

export const INVOICE_PDF_PAGE_SIZES = ["A4", "LETTER"] as const;
export type InvoicePdfPageSize = (typeof INVOICE_PDF_PAGE_SIZES)[number];

export const INVOICE_PDF_CONTENT_TYPE = "application/pdf";
export const INVOICE_PDF_NOT_FOUND = "Invoice PDF not found.";
export const INVOICE_PDF_VERSION_REQUIRED =
  "PDF generation requires an issued invoice version snapshot.";
export const INVOICE_PDF_ALREADY_EXISTS = "A PDF already exists for this invoice version.";
export const INVOICE_PDF_GENERATION_FAILED = "Invoice PDF could not be generated.";
export const INVOICE_PDF_FORBIDDEN = "You cannot access this invoice PDF.";
export const INVOICE_PDF_UNAVAILABLE = "Invoice PDF generation is temporarily unavailable.";
export const INVOICE_PDF_DOWNLOAD_UNAVAILABLE = "Invoice PDF download is temporarily unavailable.";

export type InvoicePdfFileRecord = {
  readonly id: string;
  readonly invoiceId: string;
  readonly invoiceVersionId: string;
  readonly storageKey: string;
  readonly checksumSha256: string;
  readonly byteSize: number;
  readonly contentType: string;
  readonly pageSize: InvoicePdfPageSize;
  readonly createdByUserId: string | null;
  readonly createdAt: Date;
};

export type InvoicePdfCompanyBlock = {
  readonly displayName: string;
  readonly legalName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly website: string | null;
  readonly registrationTaxNumber: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly region: string | null;
  readonly postalCode: string | null;
  readonly countryCode: string | null;
  readonly termsAndConditions: string | null;
  /** Data URI for React-pdf Image, or null when no logo. */
  readonly logoDataUri: string | null;
};

export type InvoicePdfCustomerBlock = {
  readonly displayName: string;
  readonly contactPerson: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly region: string | null;
  readonly postalCode: string | null;
  readonly countryCode: string | null;
  readonly taxRegistrationId: string | null;
};

/**
 * Render model for React-pdf. Deliberately omits internal notes (invoice + customer).
 */
export type InvoicePdfRenderModel = {
  readonly pageSize: InvoicePdfPageSize;
  readonly versionNo: number;
  readonly company: InvoicePdfCompanyBlock;
  readonly customer: InvoicePdfCustomerBlock;
  readonly invoice: {
    readonly invoiceNumber: string;
    readonly invoiceDate: string;
    readonly dueDate: string;
    readonly currencyCode: string;
    readonly referencePo: string | null;
    readonly customerNotes: string | null;
    readonly subtotal: string;
    readonly discountTotal: string;
    readonly taxTotal: string;
    readonly invoiceTotal: string;
    readonly confirmedPaidAmount: string;
    readonly outstandingAmount: string;
    readonly lineItems: InvoiceVersionSnapshot["lineItems"];
  };
};

export function buildInvoicePdfRenderModel(input: {
  readonly pageSize: InvoicePdfPageSize;
  readonly versionNo: number;
  readonly snapshot: InvoiceVersionSnapshot;
  readonly company: InvoicePdfCompanyBlock;
  readonly customer: InvoicePdfCustomerBlock;
}): InvoicePdfRenderModel {
  const invoiceNumber = input.snapshot.invoiceNumber?.trim();
  if (!invoiceNumber) {
    throw new Error(INVOICE_PDF_VERSION_REQUIRED);
  }

  return {
    pageSize: input.pageSize,
    versionNo: input.versionNo,
    company: input.company,
    customer: input.customer,
    invoice: {
      invoiceNumber,
      invoiceDate: input.snapshot.invoiceDate,
      dueDate: input.snapshot.dueDate,
      currencyCode: input.snapshot.currencyCode,
      referencePo: input.snapshot.referencePo,
      // Customer-visible notes only — never invoice.internalNotes or customer.internalNotes.
      customerNotes: input.snapshot.customerNotes,
      subtotal: input.snapshot.subtotal,
      discountTotal: input.snapshot.discountTotal,
      taxTotal: input.snapshot.taxTotal,
      invoiceTotal: input.snapshot.invoiceTotal,
      confirmedPaidAmount: input.snapshot.confirmedPaidAmount,
      outstandingAmount: input.snapshot.outstandingAmount,
      lineItems: input.snapshot.lineItems,
    },
  };
}

export function invoicePdfStorageKey(input: {
  readonly companyId: string;
  readonly invoiceId: string;
  readonly versionNo: number;
}): string {
  return `companies/${input.companyId}/invoices/${input.invoiceId}/v${input.versionNo}.pdf`;
}

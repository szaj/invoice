/**
 * Invoice email templates and BR-017 helpers (TASK-041 / Notifications §14.1).
 */

export const INVOICE_EMAIL_CUSTOMER_REQUIRED =
  "A valid customer email address is required to email this invoice.";
export const INVOICE_EMAIL_PDF_REQUIRED =
  "A stored invoice PDF is required before email can be sent.";
export const INVOICE_EMAIL_NOT_ISSUABLE =
  "Only issued (or later) invoices with a versioned PDF can be emailed.";
export const INVOICE_EMAIL_FORBIDDEN = "You cannot email this invoice.";
export const INVOICE_EMAIL_CC_FORBIDDEN = "You do not have permission to add CC or BCC recipients.";
export const INVOICE_EMAIL_CC_INVALID = "One or more CC or BCC addresses are invalid.";
export const INVOICE_EMAIL_UNAVAILABLE = "Invoice email is temporarily unavailable.";
export const INVOICE_EMAIL_SEND_FAILED = "Invoice email could not be sent.";

/**
 * Additional CC/BCC on invoice email is a controlled action.
 * Mapped to existing `invoice.edit_issued` (Admin/Compliance) — no new permission code (TASK-042; no DB change).
 */
export const INVOICE_EMAIL_CC_BCC_PERMISSION = "invoice.edit_issued" as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidCustomerEmail(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }
  const trimmed = value.trim();
  return EMAIL_PATTERN.test(trimmed);
}

/** Parse comma/semicolon/whitespace-separated addresses; empty → []. */
export function parseEmailAddressList(value: string | null | undefined): string[] {
  if (!value || value.trim().length === 0) {
    return [];
  }
  return value
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function validateEmailAddressList(
  addresses: readonly string[],
): { ok: true; emails: string[] } | { ok: false } {
  const emails: string[] = [];
  for (const address of addresses) {
    if (!isValidCustomerEmail(address)) {
      return { ok: false };
    }
    emails.push(address.trim());
  }
  return { ok: true, emails };
}

export type InvoiceEmailMergeFields = {
  readonly company_name: string;
  readonly customer_name: string;
  readonly invoice_number: string;
  readonly invoice_date: string;
  readonly due_date: string;
  readonly invoice_currency: string;
  readonly invoice_total: string;
  readonly amount_paid: string;
  readonly balance_due: string;
  readonly payment_link: string;
  readonly company_email: string;
  readonly company_phone: string;
};

export const DEFAULT_INVOICE_EMAIL_SUBJECT = "Invoice {{invoice_number}} from {{company_name}}";

export const DEFAULT_INVOICE_EMAIL_BODY = `Dear {{customer_name}},

Please find invoice {{invoice_number}} attached.

Invoice date: {{invoice_date}}
Due date: {{due_date}}
Currency: {{invoice_currency}}
Total: {{invoice_total}}
Amount paid: {{amount_paid}}
Balance due: {{balance_due}}

{{payment_link}}

Regards,
{{company_name}}
{{company_email}}
{{company_phone}}
`;

export function applyInvoiceEmailMergeFields(
  template: string,
  fields: InvoiceEmailMergeFields,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = fields[key as keyof InvoiceEmailMergeFields];
    return value ?? "";
  });
}

export function buildInvoiceEmailContent(input: {
  readonly fields: InvoiceEmailMergeFields;
  readonly templateReference?: string | null;
  readonly subjectOverride?: string | null;
  readonly bodyOverride?: string | null;
}): { readonly subject: string; readonly text: string } {
  const subjectTemplate = input.subjectOverride?.trim() || DEFAULT_INVOICE_EMAIL_SUBJECT;
  let bodyTemplate = input.bodyOverride?.trim() || DEFAULT_INVOICE_EMAIL_BODY;
  if (input.templateReference?.trim() && !input.bodyOverride?.trim()) {
    bodyTemplate = `${bodyTemplate}\n\n(Template reference: ${input.templateReference.trim()})`;
  }
  return {
    subject: applyInvoiceEmailMergeFields(subjectTemplate, input.fields).trim(),
    text: applyInvoiceEmailMergeFields(bodyTemplate, input.fields).trim(),
  };
}

export const EMAIL_DELIVERY_STATUSES = ["PENDING", "SENT", "FAILED"] as const;
export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number];

export type EmailLogRecord = {
  readonly id: string;
  readonly companyId: string;
  readonly invoiceId: string;
  readonly invoiceFileId: string | null;
  readonly recipient: string;
  readonly subject: string;
  readonly status: EmailDeliveryStatus;
  readonly providerMessageId: string | null;
  readonly errorMessage: string | null;
  readonly retryable: boolean;
  readonly sentByUserId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/** Prefill payload for the invoice email modal (TASK-042). */
export type InvoiceEmailComposeDefaults = {
  readonly invoiceId: string;
  readonly invoiceStatus: string;
  readonly recipient: string | null;
  readonly recipientValid: boolean;
  readonly subject: string;
  readonly body: string;
  readonly canCcBcc: boolean;
  readonly invoiceFileId: string | null;
  readonly hasStoredPdf: boolean;
  readonly canSend: boolean;
  readonly blockReason: string | null;
};

---
type: module
status: approved
phase: 4
domain: invoicing
tags:
  - module
---

# PDF and Email

> [!abstract] Related
> [[Invoices]] · [[Notifications]] · [[Settings]] · [[Deployment]] · [[00 Home]]

### 9.1 PDF Requirements

- Company logo and legal/display information.

- Invoice number, dates, customer billing details.

- Line items, subtotal, discounts, tax, total, paid amount, balance due.

- Invoice currency clearly displayed.

- Brand-specific terms and payment instructions.

- Professional A4/Letter-compatible layout with consistent print rendering.

- PDF generated server-side and stored as a versioned document linked to the invoice.

- Historical PDF versions must remain retrievable if an invoice is revised.

TASK-039 implements generation with `@react-pdf/renderer` (ADR-013): financial fields from `invoice_versions` snapshots; branding frozen into PDF bytes at first store; `invoice_files` metadata + StorageService blob (ADR-006); one file per version (no regenerate when stored); internal notes never printed. TASK-040 adds invoice-view preview/download of stored files (`GET /api/invoices/{id}/pdf/files/{fileId}`; historical versions selectable). TASK-041 emails stored versioned PDFs through EmailService → ResendAdapter (ADR-007); `email_logs`; BR-017. TASK-042 adds the invoice-view email modal + delivery history UI (CC/BCC gated by `invoice.edit_issued`). TASK-043 adds Duplicate + Print/Download on invoice view; print opens the stored PDF stream (TASK-040) for browser print — no alternate invoice renderer.

### 9.2 Email Invoice

- Sender identity and reply-to should be configured per company where supported.

- Recipient defaults to customer email and may allow additional CC/BCC subject to permissions (`invoice.edit_issued` for CC/BCC; Staff To-only).

- Subject/body generated from company template with merge fields (editable in the TASK-042 modal before send).

- PDF attached.

- Optional payment link(s) can be included. These links lead to hosted payment checkout, not a customer account portal.

- System records recipient, subject, sender user, timestamp, delivery request status, and provider message ID where available.

TASK-041 implements send via `POST /api/invoices/{id}/email`: From uses `EMAIL_FROM` with company display name; Reply-To uses company branding/contact email; recipient defaults to customer email; Notifications §14.1 merge fields; stored `invoice_files` PDF attached (generates once if missing, never claims success without attachment); optional `paymentLink` placeholder; `email_logs` SENT/FAILED+retryable; failure does not un-issue. Invoice modules never import the Resend SDK. TASK-042 consumes that API from `InvoiceEmailPanel` (compose prefill, CC/BCC when permitted, history table, failure/retry UX without un-issuing). TASK-058 adds optional payment-method selection on that email modal: creates hosted checkout PENDING rows and injects checkout URL(s) into `paymentLink`.

## Related Documentation

### Depends On

- [[Invoices]]
- [[Companies and Brands]]

### Integrates With

- [[Notifications]]
- [[Settings]]
- [[Payments]]

### Technical

- [[Deployment]]
- [[Error Handling]]
- [[Testing]]

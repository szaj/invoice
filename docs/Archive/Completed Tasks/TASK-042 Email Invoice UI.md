---
type: task
status: complete
phase: 4
module: invoicing
depends_on:
  - TASK-041
tags:
  - task
---

# TASK-042 — Email Invoice UI

Status: COMPLETE

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Email modal for sending the invoice.

## Source Documents

- [[PDF and Email]]
- [[Screen Inventory]]
- [[Notifications]]
- [[UI UX Design System]]

## Dependencies

[[TASK-041 Email Delivery]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Recipient defaults to customer email; additional CC/BCC subject to permissions; subject/body from template.

### Excluded

Customer portal.

## Database Changes

None.

## Backend

Consume email action. Extended TASK-041 send with optional CC/BCC (gated by existing `invoice.edit_issued`). Compose defaults via `prepareInvoiceEmailCompose` for modal prefill. No duplicate provider/PDF/audit logic.

## Frontend

Email modal + delivery history on invoice detail (`InvoiceEmailPanel`), using [[UI UX Design System]] Dialog, FormField, Alert, StatusBadge, Table, EmptyState.

## Authorization

Send requires `invoice.create` + company access + invoice view (TASK-041). CC/BCC requires `invoice.edit_issued` (Admin/Compliance); Staff CC rejected server-side.

## Business Rules

BR-017.

## Error Handling

Show failure without un-issuing the invoice. Retry via re-open send modal.

## Tests

### Unit

CC/BCC parse/validate + Staff CC denied / Admin CC allowed (`invoices-email-template`, `invoices-email`).

### Integration

Existing TASK-041 send/`email_logs` coverage remains; full suite green.

### Authorization

Unauthorized CC rejected (`INVOICE_EMAIL_CC_FORBIDDEN`).

### E2E

N/A (shell login heading regression fixed; E2E-02 live flow still env-gated).

## Definition of Done

- [x] Required schema changes completed
- [x] Backend/domain implementation completed
- [x] UI completed where applicable
- [x] Server-side authorization enforced
- [x] Business rules enforced
- [x] Tests added
- [x] Relevant tests passing
- [x] Documentation updated
- [x] [[04 Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

- `src/app/(app)/invoices/invoice-email-panel.tsx`

### Files Modified

- `src/domain/invoices/email.ts` — CC/BCC helpers, compose type, permission constant
- `src/server/email/email-provider.ts`, `resend-email-adapter.ts` — optional cc/bcc
- `src/server/invoices/invoice-email-service.ts` — CC gate, prepare compose
- `src/server/invoices/actions.ts`, `src/app/api/invoices/[id]/email/route.ts`
- `src/app/(app)/invoices/[id]/page.tsx`
- `src/app/login/page.tsx` — restore Sign in `h1` for a11y/E2E
- `tests/unit/invoices-email.test.ts`, `tests/unit/invoices-email-template.test.ts`
- Vault: [[PDF and Email]], [[Screen Inventory]], [[API and Integrations]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 04 Invoicing]], [[06 Development Log]], [[UI UX Design System]]

### Migrations

None.

### APIs

`POST /api/invoices/{id}/email` accepts optional `cc` / `bcc` (arrays or comma-separated). `GET` unchanged (history).

### Tests

Unit 262 pass. Email integration pass. Full `RUN_DB_INTEGRATION=true` integration: 52 pass / 4 skipped. Shell E2E pass (live auth skipped without credentials). typecheck / lint / format:check / build pass.

### Issues

No dedicated `invoice.email_cc` permission in catalog; CC/BCC mapped to existing `invoice.edit_issued` without new DB permission (TASK-042 forbids schema change). Full E2E-02 still needs AUTH_TEST_* credentials.

### Commit

## Next Recommended Task

[[TASK-043 Invoice Duplicate and Print]]

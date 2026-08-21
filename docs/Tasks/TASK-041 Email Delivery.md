---
type: task
status: complete
phase: 4
module: invoicing
depends_on:
  - TASK-039
  - TASK-013
tags:
  - task
---

# TASK-041 — Email Delivery

Status: COMPLETE

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Email the invoice PDF using company templates through **EmailService → ResendAdapter**. No customer portal.

## Source Documents

- [[PDF and Email]]
- [[Notifications]]
- [[Customers]]
- [[Error Handling]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-039 PDF Generation]], [[TASK-013 Core System Settings]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Per-company sender/reply-to where supported; recipient defaults to customer email; merge fields; PDF attached; optional payment-link placeholder; email_logs. Send via EmailService, not the Resend SDK from invoice modules. Queueable via BullMQ when send should not block HTTP.

### Excluded

Customer account notifications. Calling the Resend SDK from invoice/notification domain modules.

## Database Changes

email_logs.

## Backend

EmailService / EmailProvider / ResendAdapter. Record recipient, subject, sender user, timestamp, status, provider message ID.

## Frontend

None (modal is TASK-042).

## Authorization

Emailing requires valid customer email. BR-017.

## Business Rules

BR-017. Email failure: invoice remains issued; log Failed with retry.

## Error Handling

Missing email blocked. PDF failure does not send a claimed email.

## Tests

### Unit

N/A (added template/BR-017 + delivery unit coverage beyond task minimum).

### Integration

Send records email_logs.

### Authorization

N/A

### E2E

E2E-02 (full browser flow deferred; API/domain coverage here; UI is TASK-042).

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

- `src/server/email/email-provider.ts`, `email-service.ts`, `create-email-provider.ts`, `resend-email-adapter.ts`, `memory-email-provider.ts`
- `src/domain/invoices/email.ts`
- `src/server/invoices/email-log-repository.ts`, `invoice-email-service.ts`, `invoice-email-queue.ts`
- `src/app/api/invoices/[id]/email/route.ts`
- `prisma/migrations/20260821240000_email_logs/migration.sql`
- `tests/unit/invoices-email.test.ts`, `tests/unit/invoices-email-template.test.ts`
- `tests/integration/invoices-email.test.ts`

### Files Modified

- `prisma/schema.prisma` (`EmailLog`, `EmailDeliveryStatus`)
- `src/domain/audit/types.ts` (`invoices.emailed` / `invoices.email_failed`)
- `src/server/invoices/actions.ts` (`sendInvoiceEmailAction`)
- `package.json` / lockfile (`resend`)
- Vault: TASK-041, Status, Dev Log, Home, Plan, Phase 04, PDF and Email, Database, API, Testing notes as needed

### Migrations

`20260821240000_email_logs` — `email_logs` + `email_delivery_status`. Applied with `pnpm prisma:migrate:deploy`.

### APIs

- `POST /api/invoices/{id}/email` — send (same-origin); attaches stored PDF
- `GET /api/invoices/{id}/email` — list email_logs for invoice

### Tests

Unit: merge fields / BR-017 + send/attach/fail/auth. Integration: send records `email_logs` with MemoryEmailProvider. `pnpm typecheck` / `lint` / `format:check` / `test` (259) / email integration pass / `build` pass. Full `RUN_DB_INTEGRATION=true test:integration`: email test pass; 2 unrelated failures (companies-crud timeout; customers-profile leftover financial summary). E2E-02 deferred to TASK-042 UI.

### Issues

None for TASK-041 scope. ADR-009 / ADR-010 / ADR-011 / US-011 remain OPEN. Full email template CRUD and CC/BCC UI remain later (Settings / TASK-042). BullMQ worker hardening remains TASK-099 (inline dispatcher default).

### Commit

Not created (agent does not commit unless asked).

## Next Recommended Task

[[TASK-042 Email Invoice UI]]

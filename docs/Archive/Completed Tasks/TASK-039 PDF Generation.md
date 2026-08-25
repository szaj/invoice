---
type: task
status: complete
phase: 4
module: invoicing
depends_on:
  - TASK-036
  - TASK-010
  - TASK-033
  - TASK-034
tags:
  - task
---

# TASK-039 — PDF Generation

Status: COMPLETE

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Generate branded server-side PDFs with **React-pdf** and store them as versioned documents through **StorageService** (Cloudflare R2 / S3-compatible).

## Source Documents

- [[PDF and Email]]
- [[Invoices]]
- [[Data Model]]
- [[Error Handling]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-036 Invoice Lifecycle]], [[TASK-010 Company Branding Configuration]], [[TASK-033 Invoice Line Items]], [[TASK-034 Invoice Totals]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Logo, legal/display info, number, dates, billing details, lines, totals, paid, balance, currency, terms, A4/Letter, checksum. Internal notes never printed. Immutable historical PDF; do not regenerate an old invoice from today’s mutable data when a stored version exists. Queueable via BullMQ when generation should not block HTTP ([[05 Architecture Decisions#ADR-005 — Background jobs|ADR-005]]).

### Excluded

Email send. Claiming email sent if PDF failed. Calling Cloudflare-specific APIs from invoice domain code when StorageService is sufficient. Storing large PDF binaries in ordinary PostgreSQL columns.

## Database Changes

invoice_files metadata in PostgreSQL. Blob in R2 via StorageService.

## Backend

React-pdf generation in domain/application service; store once per version through StorageService. Queueable via BullMQ.

## Frontend

None (preview UI is TASK-040).

## Authorization

Based on invoice access.

## Business Rules

Historical versions retrievable.

## Error Handling

Generation error does not claim success.

## Tests

### Unit

Internal notes absent from PDF bytes/text extract fixture.

### Integration

Generate stores a file row.

### Authorization

N/A

### E2E

N/A

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

- `prisma/migrations/20260821230000_invoice_files/migration.sql`
- `src/domain/invoices/pdf.ts`
- `src/server/invoices/invoice-pdf-document.tsx`
- `src/server/invoices/invoice-pdf-render.tsx`
- `src/server/invoices/invoice-pdf-service.ts`
- `src/server/invoices/invoice-pdf-queue.ts`
- `src/server/invoices/invoice-file-repository.ts`
- `src/app/api/invoices/[id]/pdf/route.ts`
- `tests/unit/invoices-pdf.test.ts`
- `tests/integration/invoices-pdf.test.ts`

### Files Modified

- `package.json` — `@react-pdf/renderer`
- `prisma/schema.prisma` — `invoice_files`
- Issue path best-effort PDF enqueue; audit `invoices.pdf_generated`
- Vault: TASK-039, Status, Home, Plan, Phase 04, Dev Log, Invoices, Data Model, Database, PDF and Email, Testing, API

### Migrations

`20260821230000_invoice_files` — applied via `pnpm prisma:migrate:deploy`.

### APIs

- `POST /api/invoices/[id]/pdf` — generate (or reuse) PDF for latest/specified version
- `GET /api/invoices/[id]/pdf` — list file metadata (download bytes = TASK-040)
- Server Action `generateInvoicePdfAction`

### Tests

Unit: render model omits internal notes; PDF bytes/%PDF; marker absent from bytes. Integration: stores `invoice_files` row + StorageService object; idempotent reuse. `pnpm typecheck` / `lint` / `format` / `test` (255) / integration PDF / `build` pass.

### Issues

Inline dispatcher used now (queueable port ready). Dedicated BullMQ worker hardening remains [[TASK-099 Queue Hardening]]. Preview/download UI is [[TASK-040 PDF Preview and Download]].

### Commit

Not committed (await explicit request).

## Next Recommended Task

[[TASK-040 PDF Preview and Download]]

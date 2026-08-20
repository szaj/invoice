---
type: task
status: complete
phase: 1
module: companies
depends_on:
  - TASK-007
tags:
  - task
---

# TASK-010 — Company Branding Configuration

Status: COMPLETE

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Store brand identity later used by invoices, PDFs, and email.

## Source Documents

- [[Companies and Brands]]
- [[Settings]]
- [[PDF and Email]]
- [[Security]]

## Dependencies

[[TASK-007 Company CRUD]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Logo upload metadata with MIME/size validation; invoice prefix; terms; email template reference; contact details from section 5.1.

### Excluded

PDF rendering. Sending email. Sequence issuance.

## Database Changes

Company branding fields; logo file metadata.

## Backend

Company branding subresource.

## Frontend

Invoice Branding on company screens.

## Authorization

Admin only. Staff cannot edit company branding.

## Business Rules

Prefix is company-specific (e.g. VX-).

## Error Handling

Reject invalid uploads.

## Tests

### Unit

N/A

### Integration

Upload validation.

### Authorization

Staff cannot change branding.

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

`src/domain/companies/{branding-types,branding-schema,logo-validation}.ts`, `src/server/companies/{branding-repository,branding-service,branding-actions}.ts`, `src/server/storage/{storage-service,memory-storage,local-disk-storage,s3-compatible-storage,create-storage-service}.ts`, `src/app/api/companies/[id]/branding/**`, `src/app/(app)/companies/[id]/branding/**`, `prisma/migrations/20260820250000_company_branding/`, `tests/unit/company-branding.test.ts`, `tests/integration/company-branding.test.ts`.

### Files Modified

Prisma `Company` branding/logo metadata columns. Company view/list links. Prerequisite company CRUD tests updated for branding columns while still excluding invoice sequence/currencies/gateways. `.env.example`, `.gitignore` (`.data/`). [[Authorization]], [[Security]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-006 consequences, [[06 Development Log]].

### Migrations

`20260820250000_company_branding` — `companies` branding fields (`invoice_prefix`, `terms_and_conditions`, `email_template_reference`) and logo metadata (`logo_storage_key`, `logo_mime_type`, `logo_byte_size`, `logo_original_filename`, `logo_uploaded_at`). Applied with `pnpm prisma:migrate:deploy`. No invoice sequence, PDF binaries in Postgres, email sending, currencies, reporting groups, or gateway credentials.

### APIs

- `GET/PATCH /api/companies/{id}/branding`
- `GET/POST/DELETE /api/companies/{id}/branding/logo`

All require `company.write` (Admin). Server Actions mirror the same gates. Non-Admin → 403. Logo bytes go through StorageService (R2 when configured; local `.data/object-storage` in local/test). Metadata only in PostgreSQL.

### Tests

Unit: branding schema; logo MIME/magic-byte/size validation; Admin update/upload/remove; Staff denied. Integration (DB): Admin branding + logo upload; invalid upload rejected; Staff denied; migration recorded; invoice_sequence and later columns absent. `pnpm typecheck` / `lint` / `format:check` / `test` (120) / `test:integration` (27 passed, 1 skipped) / `build` pass. E2E N/A.

### Issues

PDF rendering, email sending, and invoice sequence issuance remain later tasks (TASK-035/039/041). Full audit store remains TASK-012 (safe Pino events only). R2 is preferred outside local/test; local disk is a development fallback only.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-011 Reporting Groups]]

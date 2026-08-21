---
type: task
status: complete
phase: 4
module: invoicing
depends_on:
  - TASK-036
  - TASK-012
tags:
  - task
---

# TASK-037 — Invoice Versions

Status: COMPLETE

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Preserve version metadata for issued documents. Do not silently alter issued financial documents.

## Source Documents

- [[Invoices]]
- [[Data Model]]
- [[Audit Logs]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-036 Invoice Lifecycle]], [[TASK-012 Audit Event Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

invoice_versions; reason; created_by. Until [[05 Architecture Decisions#ADR-009 — Issued invoice financial edit policy|ADR-009]] is accepted, do not implement silent financial edits. Non-financial metadata may be edited with audit history.

### Excluded

Choosing cancel-and-reissue vs revision as if already accepted.

## Database Changes

invoice_versions.

## Backend

Version snapshot metadata on issue.

## Frontend

Version history on invoice view.

## Authorization

Edit issued: Controlled for Admin/Compliance; No for Staff.

## Business Rules

Issued documents not silently altered.

## Error Handling

Issued financial PATCH rejected.

## Tests

### Unit

N/A (snapshot helpers + Staff financial/metadata auth covered in unit tests)

### Integration

Issue creates a version.

### Authorization

Staff cannot PATCH issued financial fields.

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

- `prisma/migrations/20260821210000_invoice_versions/migration.sql`
- `src/domain/invoices/versions.ts`
- `src/domain/invoices/issued-metadata-schema.ts`
- `src/server/invoices/invoice-version-repository.ts`
- `src/server/invoices/invoice-version-service.ts`
- `src/app/api/invoices/[id]/versions/route.ts`
- `src/app/(app)/invoices/invoice-version-history-panel.tsx`
- `src/app/(app)/invoices/issued-invoice-metadata-form.tsx`
- `tests/unit/invoices-versions.test.ts`
- `tests/integration/invoices-versions.test.ts`

### Files Modified

- Issue flow creates immutable version snapshot (v1, reason `Issued`)
- `PATCH /api/invoices/{id}`: draft → draft update; issued financial keys rejected; non-financial metadata via `invoice.edit_issued`
- Invoice detail: version history + Admin/Compliance metadata form
- Audit: `invoices.version_created`, `invoices.metadata_updated`

### Migrations

`20260821210000_invoice_versions` — applied via `pnpm prisma:migrate:deploy`

### APIs

- `GET /api/invoices/{id}/versions`
- Issued metadata via existing `PATCH /api/invoices/{id}` (non-financial only)

### Tests

- Unit: snapshot build, financial key detection, Staff rejection
- Integration: issue creates version; Staff financial/metadata denied; Admin metadata ok; historical snapshot unchanged

### Issues

- **ADR-009 remains OPEN**: no financial revision / cancel-and-reissue workflow. Versions are issue-time immutable snapshots only.
- Metadata edits do **not** create a new version (would imply financial revision policy).

### Commit

Not committed in this session.

## Next Recommended Task

[[TASK-038 Invoice Cancellation]]

---
type: task
status: complete
phase: 3
module: customers
depends_on:
  - TASK-023
tags:
  - task
---

# TASK-027 — Customer Notes

Status: COMPLETE

Phase: 3 ([[Phase 03 Customers]])

## Objective

Internal-only customer notes with author and timestamp.

## Source Documents

- [[Customers]]
- [[Data Model]]
- [[Audit Logs]]

## Dependencies

[[TASK-023 Customer CRUD Service]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

customer_notes; internal visibility; author/timestamp.

### Excluded

Customer-visible portal notes. Notes on PDFs.

## Database Changes

customer_notes.

## Backend

Notes create/list on customer.

## Frontend

Notes on profile.

## Authorization

Internal-only. Respect company assignment.

## Business Rules

Notes are internal-only.

## Error Handling

N/A

## Tests

### Unit

Notes omitted from any PDF/email payload fixture.

### Integration

Create/list notes.

### Authorization

Scoped by assignment.

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

- `prisma/migrations/20260821140000_customer_notes/migration.sql`
- `src/domain/customers/{notes,note-schema,external-document-payload}.ts`
- `src/server/customers/{customer-note-repository,customer-note-service}.ts`
- `src/app/api/customers/[id]/notes/route.ts`
- `src/app/(app)/customers/[id]/customer-notes-panel.tsx`
- `tests/unit/customers-notes.test.ts`
- `tests/integration/customers-notes.test.ts`

### Files Modified

- `prisma/schema.prisma` — `CustomerNote` + visibility enum
- Profile types/service/UI to show real notes
- `src/server/customers/actions.ts` — `createCustomerNoteAction`
- `src/domain/audit/types.ts` — `customers.note_created`
- [[Customers]], [[Data Model]], [[Database]], [[Authorization]], [[API and Integrations]], [[Audit Logs]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 03 Customers]], [[06 Development Log]]

### Migrations

`20260821140000_customer_notes` — applied with `pnpm prisma:migrate:deploy`.

### APIs

`GET|POST /api/customers/{id}/notes` — `customer.edit` + customer access (`customer_companies` ∩ assignment). Create-only (no edit/delete). Visibility always `INTERNAL`.

### Tests

Unit: PDF/email fixture omits notes; Staff denied outside assignment; create audits. Integration: create/list + Staff 403. `pnpm typecheck` / `lint` / `format:check` / `test` (204) / `RUN_DB_INTEGRATION=true test:integration` (42 passed, 4 skipped) / `build` pass. E2E N/A.

### Issues

None. No portal notes. No PDF/email sending implemented — fixture proves omission. ADR-011 remains OPEN.

### Commit

Uncommitted (agent did not create a commit).

## Next Recommended Task

[[TASK-028 Customer Duplicate Detection and Status]]

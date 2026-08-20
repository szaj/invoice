---
type: task
status: complete
phase: 1
module: companies
depends_on:
  - TASK-005
  - TASK-002
tags:
  - task
---

# TASK-007 — Company CRUD

Status: COMPLETE

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Create, edit, activate, and deactivate companies/brands.

## Source Documents

- [[Companies and Brands]]
- [[Data Model]]
- [[Settings]]
- [[Screen Inventory]]

## Dependencies

[[TASK-005 Roles and Permissions Model]], [[TASK-002 Database Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Company record fields from [[Companies and Brands]] 5.1 except gateway credentials and currency-subset wiring. Identity, address, status, names.

### Excluded

Payment gateway credentials. Enabling currencies. Issuing invoice numbers.

## Database Changes

companies entity.

## Backend

GET/POST /companies; GET/PATCH /companies/{id}.

## Frontend

Companies list/create/edit/view.

## Authorization

Only Admin creates/edits companies.

## Business Rules

Do not weaken later tenant isolation.

## Error Handling

Invalid company updates rejected.

## Tests

### Unit

N/A

### Integration

Company CRUD.

### Authorization

Non-Admin cannot mutate companies.

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

`src/domain/companies/{types,countries,company-schema}.ts`, `src/server/companies/{company-repository,company-service,actions}.ts`, `src/app/api/companies/route.ts`, `src/app/api/companies/[id]/route.ts`, `src/app/(app)/companies/**`, `prisma/migrations/20260820230000_company_crud/`, `tests/unit/companies-crud.test.ts`, `tests/integration/companies-crud.test.ts`.

### Files Modified

Prisma `Company` model and `CompanyStatus` enum. Home Admin link. Prerequisite tests that previously forbade any `companies` table. [[Authorization]], [[Security]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-003 consequences, [[06 Development Log]].

### Migrations

`20260820230000_company_crud` — `companies` (identity, structured address, ISO country, contact, registration/tax number, Active/Inactive). Applied with `pnpm prisma:migrate:deploy`. No `user_companies`, currencies, invoice numbering, logo/branding files, reporting groups, or gateway credentials.

### APIs

- `GET/POST /api/companies`
- `GET/PATCH /api/companies/{id}`

All require `company.write` (Admin). Server Actions mirror the same gates. Non-Admin → 403. No DELETE; deactivate is status `INACTIVE`.

### Tests

Unit: Admin create/update/deactivate; invalid updates and later-task fields rejected; Compliance/Staff denied list and mutate. Integration (DB): Admin CRUD + deactivate with row retained; Staff denied; migration recorded; excluded columns/tables absent. Auth/user suites still green. E2E N/A.

### Issues

Company assignment, tenant isolation, branding/logo upload, invoice prefix/sequence, currencies, and gateway credentials remain later tasks. List/get are Admin-only so unassigned companies are not leaked before TASK-008/009. Full audit store remains TASK-012 (safe Pino events only). ADR-011 reporting-currency default remains OPEN and was not implemented here.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-008 User Company Assignments]]

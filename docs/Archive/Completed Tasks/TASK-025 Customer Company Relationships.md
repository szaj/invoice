---
type: task
status: complete
phase: 3
module: customers
depends_on:
  - TASK-023
  - TASK-008
tags:
  - task
---

# TASK-025 — Customer Company Relationships

Status: COMPLETE

Phase: 3 ([[Phase 03 Customers]])

## Objective

Link a customer to multiple companies without duplicating the master record, subject to tenant access policies.

## Source Documents

- [[Customers]]
- [[Companies and Brands]]
- [[Data Model]]

## Dependencies

[[TASK-023 Customer CRUD Service]], [[TASK-008 User Company Assignments]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

customer_companies; filter by company or authorized companies.

### Excluded

Sharing a customer across companies the user is not assigned to.

## Database Changes

customer_companies.

## Backend

Company linkage APIs with server-side assignment checks.

## Frontend

Company linkage on customer create/edit.

## Authorization

Users only see/link companies they can access. Admin may link across companies.

## Business Rules

Tenant isolation. Customer master is reusable across authorized companies.

## Error Handling

Unauthorized linkage rejected.

## Tests

### Unit

N/A

### Integration

Link/unlink.

### Authorization

Staff cannot link unauthorized companies.

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

- `prisma/migrations/20260821120000_customer_companies/migration.sql`
- `src/app/api/customers/[id]/companies/route.ts` — GET/PUT/POST/DELETE company links

### Files Modified

- `prisma/schema.prisma` — `CustomerCompany` model
- `src/domain/customers/{access,types,schema,list-query}.ts` — link-based access; `companyIds` / `companyId` filter
- `src/server/customers/{customer-repository,customer-service,actions}.ts`
- `src/app/(app)/customers/**` — linkage UI + company list filter
- `src/domain/audit/types.ts` — `customers.companies_updated`
- Unit/integration customer tests
- [[Customers]], [[Data Model]], [[Database]], [[Authorization]], [[Security]], [[API and Integrations]], [[Audit Logs]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 03 Customers]], [[06 Development Log]]

### Migrations

`20260821120000_customer_companies` — creates `customer_companies`; backfills from existing `default_company_id`. Applied with `pnpm prisma:migrate:deploy`.

### APIs

- `GET|PUT|POST|DELETE /api/customers/{id}/companies` (PUT set; POST link; DELETE `?companyId=`)
- List `GET /api/customers` accepts `companyId` filter
- Create/update accept `companyIds`

### Tests

Unit: access via links; Staff denied unauthorized link; merge preserves Admin-only links. Integration: link/unlink + Staff 403 on unauthorized company. `pnpm typecheck` / `lint` / `format:check` / `test` (198) / `RUN_DB_INTEGRATION=true test:integration` (40 passed, 4 skipped) / `build` pass. E2E N/A.

### Issues

None. Interim TASK-023 `defaultCompanyId` / assignee access superseded by `customer_companies` intersection. `defaultCompanyId` remains preference only (must be linked when set). ADR-011 remains OPEN.

### Commit

Uncommitted (agent did not create a commit).

## Next Recommended Task

[[TASK-026 Customer Profile]]

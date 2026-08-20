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

# TASK-011 — Reporting Groups

Status: COMPLETE

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Optional parent reporting groups for roll-up reporting without weakening company access.

## Source Documents

- [[Companies and Brands]]
- [[Dashboard and Reporting]]
- [[Settings]]
- [[Data Model]]

## Dependencies

[[TASK-007 Company CRUD]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

company_groups; assign companies. VX is an example, not required seed data.

### Excluded

Monthly brand matrix report. Using group membership as authorization.

## Database Changes

company_groups; companies reporting_group_id / parent group.

## Backend

CRUD for reporting groups; assign brands.

## Frontend

Settings: Reporting Groups.

## Authorization

Group membership never bypasses company assignment.

## Business Rules

Historical ownership remains the original company/brand.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Group assignment persistence.

### Authorization

Staff cannot gain extra company access via a group.

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

`src/domain/reporting-groups/{types,schema}.ts`, `src/server/reporting-groups/{reporting-group-repository,reporting-group-service,actions}.ts`, `src/app/api/reporting-groups/**`, `src/app/(app)/settings/reporting-groups/**`, `prisma/migrations/20260820260000_reporting_groups/`, `tests/unit/reporting-groups.test.ts`, `tests/integration/reporting-groups.test.ts`.

### Files Modified

Prisma `CompanyGroup` model and `companies.reporting_group_id`. Home Admin link. Prerequisite tests updated for `company_groups` / `reporting_group_id`. [[Authorization]], [[Security]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-003 consequences, [[06 Development Log]].

### Migrations

`20260820260000_reporting_groups` — `company_groups` (name, code, status, display_order) and `companies.reporting_group_id` FK (`ON DELETE SET NULL`). Applied with `pnpm prisma:migrate:deploy`. No VX seed data. No reporting engines, currencies, invoices, payments, or audit tables.

### APIs

- `GET/POST /api/reporting-groups`
- `GET/PATCH /api/reporting-groups/{id}`

All require `company.write` (Admin). PATCH with `{ status }` activates/deactivates. Company assignment via `companyIds` on create/update. Non-Admin → 403. Membership is reporting-only; `assertCompanyAccess` / `user_companies` remain authoritative.

### Tests

Unit: schema; Admin CRUD; Staff denied mutate/list; group membership does not grant company access. Integration (DB): assignment persistence; Staff GET unassigned company in same group → 403; Staff cannot mutate groups; migration recorded. `pnpm typecheck` / `lint` / `format:check` / `test` (125) / `test:integration` (29 passed, 1 skipped) / `build` pass. E2E N/A.

### Issues

Monthly brand matrix and reporting-group rollup engines remain TASK-088/089. Full audit store remains TASK-012. No new ADR; ADR-003 consequences updated.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-012 Audit Event Foundation]]

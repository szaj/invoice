---
type: task
status: complete
phase: 1
module: companies
depends_on:
  - TASK-006
  - TASK-007
tags:
  - task
---

# TASK-008 — User Company Assignments

Status: COMPLETE

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Constrain access by company assignment. Admin may access all companies; Compliance and Staff are assigned to specific companies.

## Source Documents

- [[Roles and Permissions]]
- [[Companies and Brands]]
- [[Data Model]]
- [[Security]]

## Dependencies

[[TASK-006 User Management]], [[TASK-007 Company CRUD]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

user_companies; Admin assignment UI; server-side checks that Compliance/Staff cannot act outside assigned companies.

### Excluded

Company switcher UI. Treating reporting-group membership as authorization.

## Database Changes

user_companies (user_id, company_id).

## Backend

Persist assignments. Query helpers for assigned company IDs.

## Frontend

Assignment controls on user edit.

## Authorization

Hiding records in the UI is not sufficient. BR-016.

## Business Rules

BR-016. Tenant isolation from [[Companies and Brands]].

## Error Handling

Unassigned company access denied.

## Tests

### Unit

N/A

### Integration

Assignment persistence.

### Authorization

Staff denied unassigned company data.

### E2E

E2E-07 precursor.

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

`src/domain/authz/company-access.ts`, `src/app/(app)/users/company-assignment-fields.tsx`, `prisma/migrations/20260820240000_user_company_assignments/`, `tests/unit/company-assignments.test.ts`, `tests/integration/company-assignments.test.ts`.

### Files Modified

Prisma `UserCompany`; User/Company relations. Authorization principal loads `assignedCompanyIds`. User create/update persist `companyIds`. `GET /api/companies/{id}` uses `assertCompanyAccess`. Admin company UI still requires `company.write`. User create/edit assignment checkboxes. [[Authorization]], [[Security]], [[API and Integrations]], [[Database]], [[Authentication]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-003 consequences, [[06 Development Log]].

### Migrations

`20260820240000_user_company_assignments` — `user_companies (user_id, company_id)` with composite PK and FKs. Applied with `pnpm prisma:migrate:deploy`. No switcher, reporting groups, currencies, invoices, or payments.

### APIs

- User create/PATCH include `companyIds` (Admin/`user.manage`).
- `GET /api/companies/{id}` requires company access: Admin ALL, Compliance/Staff assigned only. Unassigned → 403.
- Company list/create/PATCH/status remain `company.write` (Admin).

### Tests

Unit: Admin ALL without assignment rows; Staff assigned vs unassigned; reporting-group field ignored; assignment persist/replace; unknown company IDs rejected. Integration (DB): assignment rows persisted; Staff GET assigned allowed; Staff GET unassigned 403 (E2E-07 precursor); Staff list still 403. US-007–010 remain denied. E2E N/A.

### Issues

Company switcher and per-request company context remain [[TASK-009 Tenant Isolation and Company Context]]. Reporting groups are not authorization. Admin ALL is independent of `user_companies` rows. Audit store remains TASK-012 (safe Pino events only).

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-009 Tenant Isolation and Company Context]]

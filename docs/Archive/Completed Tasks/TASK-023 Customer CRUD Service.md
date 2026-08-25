---
type: task
status: complete
phase: 3
module: customers
depends_on:
  - TASK-022
  - TASK-009
  - TASK-005
tags:
  - task
---

# TASK-023 — Customer CRUD Service

Status: COMPLETE

Phase: 3 ([[Phase 03 Customers]])

## Objective

Create customer create/read/update APIs with role rules.

## Source Documents

- [[Customers]]
- [[Roles and Permissions]]
- [[API and Integrations]]

## Dependencies

[[TASK-022 Customer Domain Schema]], [[TASK-009 Tenant Isolation and Company Context]], [[TASK-005 Roles and Permissions Model]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

GET/POST /customers; GET/PATCH /customers/{id}. Search. Soft-delete/deactivation rather than hard delete when financial records exist.

### Excluded

Hard delete. Customer portal.

## Database Changes

No additional tables required.

## Backend

CRUD + search with company-scoped authorization.

## Frontend

None (UI is TASK-024).

## Authorization

Create: Admin/Compliance/Staff. Delete: Restricted as matrix. Edit limited/assigned for Staff.

## Business Rules

BR-012.

## Error Handling

403 outside assignment.

## Tests

### Unit

N/A

### Integration

CRUD happy path.

### Authorization

Role matrix on create/edit/delete.

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

`src/domain/customers/access.ts`, `src/server/customers/customer-service.ts`, `src/app/api/customers/route.ts`, `src/app/api/customers/[id]/route.ts`, `src/app/api/customers/[id]/status/route.ts`, `tests/unit/customers-crud.test.ts`, `tests/integration/customers-crud.test.ts`.

### Files Modified

Customer repository (list/search + scoped queries); customer types/schema (search + error constants); audit actions/entity for customers. [[Customers]], [[Authorization]], [[Security]], [[API and Integrations]], [[Audit Logs]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 03 Customers]], [[06 Development Log]], [[TASK-023 Customer CRUD Service]].

### Migrations

None. Reuses TASK-022 `customers` table.

### APIs

- `GET/POST /api/customers` — list/search (`q`, `status`) and create
- `GET/PATCH /api/customers/{id}` — read/update (cannot deactivate via PATCH)
- `POST /api/customers/{id}/status` — soft ACTIVE/INACTIVE (`customer.delete`, Admin)

Create: `customer.create` (Admin/Compliance/Staff). Staff/Compliance require accessible `defaultCompanyId`. Staff auto-assigns self as `assignedStaffUserId` when omitted. List/get/edit: `customer.edit` + company/staff access (`defaultCompanyId` in assigned companies or assignee match) until `customer_companies` (TASK-025). Soft-deactivate only; hard delete never. Audits created/updated/status_changed.

### Tests

Unit: access rules; Staff company required; Staff denied unassigned; Staff denied deactivate; Admin soft-deactivate; edit cannot set INACTIVE. Integration: Admin CRUD + search + deactivate; Staff 403 outside assignment; no `customer_companies`. `pnpm typecheck` / `lint` / `format:check` / `test` (194) / `RUN_DB_INTEGRATION=true test:integration` (40 passed, 4 skipped) / `build` pass. E2E N/A.

### Issues

Company scope uses `defaultCompanyId` / `assignedStaffUserId` until TASK-025 `customer_companies`. UI is TASK-024. ADR-011 remains OPEN.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-024 Customer List and Form UI]]

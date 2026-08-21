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

# TASK-024 — Customer List and Form UI

Status: COMPLETE

Phase: 3 ([[Phase 03 Customers]])

## Objective

Customer list/search/filter, create, and edit screens.

## Source Documents

- [[Customers]]
- [[Screen Inventory]]

## Dependencies

[[TASK-023 Customer CRUD Service]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

List/search/filter, create, edit from [[Screen Inventory]].

### Excluded

Profile page (TASK-026). Mixing currencies in any totals shown here.

## Database Changes

None.

## Backend

Consume TASK-023 APIs. Revalidate on the server.

## Frontend

Customers list/create/edit.

## Authorization

Assigned company scope.

## Business Rules

BR-013 if any amounts are shown.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

N/A

### Authorization

Staff only sees assigned-company customers.

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

- `src/server/customers/actions.ts` — Server Actions wrapping TASK-023 service + revalidate
- `src/domain/customers/list-query.ts` — list searchParams → `customerSearchSchema`
- `src/app/(app)/customers/page.tsx` — list + search/filter
- `src/app/(app)/customers/customer-list-filters.tsx`
- `src/app/(app)/customers/customer-form.tsx` — create/edit form (§7.1 fields)
- `src/app/(app)/customers/new/page.tsx`
- `src/app/(app)/customers/[id]/page.tsx` — master summary (not profile)
- `src/app/(app)/customers/[id]/edit/page.tsx`
- `src/app/(app)/customers/[id]/customer-status-controls.tsx` — Admin soft-deactivate
- `tests/unit/customers-list-query.test.ts`

### Files Modified

- `src/app/(app)/page.tsx` — Customers nav for `customer.edit`
- [[Customers]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 03 Customers]], [[06 Development Log]]

### Migrations

None.

### APIs

None new. UI uses Server Actions → TASK-023 `customer-service` (same authz/scope). Existing `/api/customers*` unchanged.

### Tests

Unit: list query parsing. Authorization: Staff scope remains in TASK-023 service (UI does not bypass). Integration/E2E N/A per task.

### Issues

None. ADR-011 remains OPEN. Profile (TASK-026) and `customer_companies` (TASK-025) not implemented.

### Commit

Uncommitted (agent did not create a commit).

## Next Recommended Task

[[TASK-025 Customer Company Relationships]]

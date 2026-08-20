---
type: task
status: not-started
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

Status: NOT STARTED

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

- [ ] Required schema changes completed
- [ ] Backend/domain implementation completed
- [ ] UI completed where applicable
- [ ] Server-side authorization enforced
- [ ] Business rules enforced
- [ ] Tests added
- [ ] Relevant tests passing
- [ ] Documentation updated
- [ ] [[04 Implementation Status]] updated
- [ ] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

### Files Modified

### Migrations

### APIs

### Tests

### Issues

### Commit

## Next Recommended Task

[[TASK-024 Customer List and Form UI]]

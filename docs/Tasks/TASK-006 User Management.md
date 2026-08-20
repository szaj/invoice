---
type: task
status: not-started
phase: 1
module: auth
depends_on:
  - TASK-005
tags:
  - task
---

# TASK-006 — User Management

Status: NOT STARTED

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Admin can create, edit, suspend, and reset users.

## Source Documents

- [[Roles and Permissions]]
- [[Settings]]
- [[Screen Inventory]]
- [[Audit Logs]]

## Dependencies

[[TASK-005 Roles and Permissions Model]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Account fields from [[Roles and Permissions]] 4.1 except company assignment (next tasks). Optional MFA status field; do not require MFA for all users.

### Excluded

Company assignment. Full MFA challenge productization beyond the optional field/flag.

## Database Changes

users fields from [[Data Model]].

## Backend

Admin CRUD, suspend/reset under /users.

## Frontend

Users list/create/edit.

## Authorization

Only Admin manages users.

## Business Rules

Least privilege.

## Error Handling

Non-Admin user-admin attempts return 403.

## Tests

### Unit

N/A

### Integration

User CRUD happy path.

### Authorization

Non-Admin cannot manage users.

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

[[TASK-007 Company CRUD]]

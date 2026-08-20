---
type: task
status: not-started
phase: 1
module: auth
depends_on:
  - TASK-003
tags:
  - task
---

# TASK-005 — Roles and Permissions Model

Status: NOT STARTED

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Implement Admin, Compliance, and Staff RBAC from the permission matrix.

## Source Documents

- [[Roles and Permissions]]
- [[Security]]
- [[Business Rules]]

## Dependencies

[[TASK-003 Authentication Base]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Role definitions and the matrix in [[Roles and Permissions]]. Record optional Staff policies from [[Unresolved Source Items]] as open policy, do not invent grants.

### Excluded

Company assignment UI. Financial module checks that need those modules.

## Database Changes

roles / permissions mapping.

## Backend

Enforce role checks in domain/API layers. Frontend hiding is not authorization.

## Frontend

None beyond what user management later needs.

## Authorization

Backend permission checks are mandatory. BR-016.

## Business Rules

BR-016. Customer hard-delete remains restricted as specified.

## Error Handling

403 on permission failure. [[Error Handling]]

## Tests

### Unit

Role helper unit tests.

### Integration

N/A

### Authorization

Admin vs Compliance vs Staff on a representative protected action.

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

[[TASK-006 User Management]]

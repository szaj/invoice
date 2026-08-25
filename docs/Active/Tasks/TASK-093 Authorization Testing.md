---
type: task
status: not-started
phase: 9
module: qa
depends_on:
  - TASK-009
  - TASK-005
tags:
  - task
---

# TASK-093 — Authorization Testing

Status: NOT STARTED

Phase: 9 ([[Phase 09 Hardening and Deployment]])

## Objective

Complete **Vitest** authorization tests for cross-company data leakage and the role matrix. Prove `authenticated ≠ authorized` and that Route Handlers / Server Actions cannot be used to skip company checks.

## Source Documents

- [[Testing]]
- [[Security]]
- [[Roles and Permissions]]
- [[Engineering Rules]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-009 Tenant Isolation and Company Context]], [[TASK-005 Roles and Permissions Model]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Cross-company leakage tests; role permission tests; 403 on permission failure.

### Excluded

Relying on UI hiding.

## Database Changes

None.

## Backend

Automated authorization suite.

## Frontend

N/A

## Authorization

Server-side enforcement verified.

## Business Rules

BR-016.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

N/A

### Authorization

CI authorization tests passing.

### E2E

E2E-07.

## Definition of Done

- [ ] Required schema changes completed
- [ ] Backend/domain implementation completed
- [ ] UI completed where applicable
- [ ] Server-side authorization enforced
- [ ] Business rules enforced
- [ ] Tests added
- [ ] Relevant tests passing
- [ ] Documentation updated
- [ ] [[03 Current Implementation Status]] updated
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

[[TASK-094 Financial Calculation Testing]]

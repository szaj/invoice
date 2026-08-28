---
type: task
status: complete
phase: 9
module: qa
depends_on:
  - TASK-009
  - TASK-005
tags:
  - task
---

# TASK-093 — Authorization Testing

Status: COMPLETE

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

- [x] Required schema changes completed
- [x] Backend/domain implementation completed
- [x] UI completed where applicable
- [x] Server-side authorization enforced
- [x] Business rules enforced
- [x] Tests added
- [x] Relevant tests passing
- [x] Documentation updated
- [x] [[03 Current Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

- `tests/helpers/authz-fixtures.ts` — shared principals and company IDs
- `tests/unit/authorization-suite.test.ts` — role matrix, authenticated≠authorized, 403 responses, route/action boundary checks
- `tests/integration/authorization-suite.test.ts` — cross-company leakage across company/customer/invoice reads

### Files Modified

- `package.json` — `test:auth` script for targeted authorization suite

### Migrations

None.

### APIs

None.

### Tests

- `pnpm test:auth` — 21 unit authorization tests
- `pnpm test` — full unit suite (includes authorization suite)
- Integration suite runs with `RUN_DB_INTEGRATION=true`

### Issues

None.

### Commit

Not committed in this session.

## Next Recommended Task

[[TASK-094 Financial Calculation Testing]]

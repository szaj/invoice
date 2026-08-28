---
type: task
status: complete
phase: 9
module: qa
depends_on:
  - TASK-019
  - TASK-046
  - TASK-070
tags:
  - task
---

# TASK-094 — Financial Calculation Testing

Status: COMPLETE

Phase: 9 ([[Phase 09 Hardening and Deployment]])

## Objective

**Vitest** unit tests for money calculations using Prisma Decimal (never JS float), status logic, fixed-rate conversion, invoice numbering, CB/RF.

## Source Documents

- [[Testing]]
- [[Currency and Conversion]]
- [[02 Current Product Rules]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-019 Money Calculation Utilities]], [[TASK-046 Settlement Conversion Snapshot]], [[TASK-070 CBRF Calculation Engine]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Cover BR-020 to BR-026 and conversion locking.

### Excluded

Using floating-point assertions.

## Database Changes

None.

## Backend

Unit test suite.

## Frontend

N/A

## Authorization

N/A

## Business Rules

BR-020–BR-026.

## Error Handling

N/A

## Tests

### Unit

E2E-13 calculation assertions plus unit suite.

### Integration

N/A

### Authorization

N/A

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
- [x] [[03 Current Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

- `tests/unit/financial-calculation-suite.test.ts`
- `tests/helpers/financial-calculation-fixtures.ts`

### Files Modified

- `package.json` — added `test:finance` script

### Migrations

None.

### APIs

None.

### Tests

- `pnpm test:finance` — 22 unit tests covering BR-020–BR-026, conversion snapshot locking, invoice numbering, status logic, Decimal boundary, financial domain source scan, and E2E-13 calculation chain
- `pnpm typecheck` — pass

### Issues

None.

### Commit

Not committed (awaiting user request).

## Next Recommended Task

[[TASK-095 Webhook Testing]]

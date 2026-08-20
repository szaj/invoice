---
type: task
status: not-started
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

Status: NOT STARTED

Phase: 9 ([[Phase 09 Hardening and Deployment]])

## Objective

**Vitest** unit tests for money calculations using Prisma Decimal (never JS float), status logic, fixed-rate conversion, invoice numbering, CB/RF.

## Source Documents

- [[Testing]]
- [[Currency and Conversion]]
- [[Business Rules]]
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

[[TASK-095 Webhook Testing]]

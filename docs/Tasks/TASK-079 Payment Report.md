---
type: task
status: not-started
phase: 8
module: reporting
depends_on:
  - TASK-046
  - TASK-047
tags:
  - task
---

# TASK-079 — Payment Report

Status: NOT STARTED

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Payment report including rate snapshot and converted settlement; optional fee and actual received.

## Source Documents

- [[Dashboard and Reporting]]
- [[Payments]]

## Dependencies

[[TASK-046 Settlement Conversion Snapshot]], [[TASK-047 Merchant Fee Reconciliation Fields]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Minimum output from Payment Report row in 13.3.

### Excluded

Using live rates in the report.

## Database Changes

Queries.

## Backend

Payment report endpoint.

## Frontend

Payment Report screen.

## Authorization

Role-scoped.

## Business Rules

Stored snapshots only.

## Error Handling

N/A

## Tests

### Unit

Uses stored snapshots.

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

[[TASK-080 Outstanding Report]]

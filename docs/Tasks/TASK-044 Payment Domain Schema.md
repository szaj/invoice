---
type: task
status: not-started
phase: 5
module: payments
depends_on:
  - TASK-030
  - TASK-019
  - TASK-020
tags:
  - task
---

# TASK-044 — Payment Domain Schema

Status: NOT STARTED

Phase: 5 ([[Phase 05 Payments]])

## Objective

Create the payment record model with independent financial fields.

## Source Documents

- [[Payments]]
- [[Data Model]]
- [[Definitions]]
- [[Business Rules]]

## Dependencies

[[TASK-030 Invoice Domain Schema]], [[TASK-019 Money Calculation Utilities]], [[TASK-020 Settlement Currency Configuration]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Payment fields from [[Payments]] 10.3 including amounts, settlement, snapshot placeholders, optional fee, optional actual received, statuses Pending/Successful/Failed.

### Excluded

Gateway charges. Overwriting confirmed fields. Using fee in balance math.

## Database Changes

payments.

## Backend

Persistence model + invariants on the record.

## Frontend

None required.

## Authorization

Modify confirmed payment: adjustment workflow only (Phase 06).

## Business Rules

BR-004, BR-005, BR-020.

## Error Handling

N/A

## Tests

### Unit

Fee stored separately from converted amount.

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

[[TASK-045 Payment Service]]

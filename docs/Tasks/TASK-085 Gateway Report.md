---
type: task
status: not-started
phase: 8
module: reporting
depends_on:
  - TASK-079
  - TASK-047
tags:
  - task
---

# TASK-085 — Gateway Report

Status: NOT STARTED

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Transactions, converted settlement totals, optional fees, optional actual received, failures, refunds by gateway and settlement currency.

## Source Documents

- [[Dashboard and Reporting]]
- [[Payments]]

## Dependencies

[[TASK-079 Payment Report]], [[TASK-047 Merchant Fee Reconciliation Fields]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Gateway report minimum output.

### Excluded

Deducting fees from converted settlement totals.

## Database Changes

Queries.

## Backend

Gateway report endpoint.

## Frontend

Gateway Report.

## Authorization

Role-scoped.

## Business Rules

Fees separate.

## Error Handling

N/A

## Tests

### Unit

Fee separation.

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

[[TASK-086 Currency Report]]

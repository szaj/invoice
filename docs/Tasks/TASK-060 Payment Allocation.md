---
type: task
status: not-started
phase: 5
module: payments
depends_on:
  - TASK-059
  - TASK-034
tags:
  - task
---

# TASK-060 — Payment Allocation

Status: NOT STARTED

Phase: 5 ([[Phase 05 Payments]])

## Objective

Recalculate invoice status from confirmed payment applications.

## Source Documents

- [[Payments]]
- [[Invoices]]
- [[Business Rules]]

## Dependencies

[[TASK-059 Partial Payments]], [[TASK-034 Invoice Totals]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Partially Paid when confirmed applied > 0 and < total; Paid when outstanding reaches zero within rounding tolerance.

### Excluded

Storing a user-edited paid total as source of truth.

## Database Changes

Invoice status derived from payments.

## Backend

Allocation + status recalculation after confirm.

## Frontend

Invoice paid/outstanding display.

## Authorization

N/A beyond payment/invoice access.

## Business Rules

BR-009, BR-010.

## Error Handling

N/A

## Tests

### Unit

Partial then completing payment; over-application rejection.

### Integration

Status becomes Partially Paid then Paid.

### Authorization

N/A

### E2E

E2E-03, E2E-04.

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

[[TASK-061 Payment List UI]]

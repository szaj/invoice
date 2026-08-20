---
type: task
status: not-started
phase: 6
module: payments
depends_on:
  - TASK-064
tags:
  - task
---

# TASK-065 — Partial Refunds

Status: NOT STARTED

Phase: 6 ([[Phase 06 Payment Adjustments]])

## Objective

Record partial refunds with a cumulative cap against the original payment.

## Source Documents

- [[Refunds Disputes Chargebacks]]
- [[Business Rules]]

## Dependencies

[[TASK-064 Full Refunds]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Partial Refund Processed; CB/RF for processed amount only. Cumulative deductions must not exceed the original payment unless an authorized correction workflow explicitly allows it.

### Excluded

Silent over-refund.

## Database Changes

Additional adjustment rows.

## Backend

Partial refund endpoint with cumulative cap.

## Frontend

API; UI in TASK-069.

## Authorization

Same as full refund.

## Business Rules

BR-023.

## Error Handling

Over-refund rejected by default.

## Tests

### Unit

Cumulative cap.

### Integration

Partial refund row.

### Authorization

N/A

### E2E

E2E-15.

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

[[TASK-066 Chargeback Debit Loss]]

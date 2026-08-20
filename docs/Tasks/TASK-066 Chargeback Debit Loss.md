---
type: task
status: not-started
phase: 6
module: payments
depends_on:
  - TASK-063
tags:
  - task
---

# TASK-066 — Chargeback Debit Loss

Status: NOT STARTED

Phase: 6 ([[Phase 06 Payment Adjustments]])

## Objective

Record chargeback debit/loss as a linked adjustment included in CB/RF.

## Source Documents

- [[Refunds Disputes Chargebacks]]
- [[Dashboard and Reporting]]

## Dependencies

[[TASK-063 Dispute Open Workflow]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Chargeback Debited/Lost; merchant reference/case ID; reason; dates; original payment preserved.

### Excluded

Deleting or reversing the original success row.

## Database Changes

payment_adjustments type chargeback debit/loss.

## Backend

Record Chargeback Debit/Loss.

## Frontend

API this cycle.

## Authorization

Authorized roles only.

## Business Rules

BR-024.

## Error Handling

N/A

## Tests

### Unit

CB/RF includes the debit on effective date (with TASK-070).

### Integration

Debit adjustment created.

### Authorization

Staff denied.

### E2E

E2E-16 first half.

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

[[TASK-067 Chargeback Won Reversal]]

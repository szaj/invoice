---
type: task
status: not-started
phase: 6
module: payments
depends_on:
  - TASK-045
  - TASK-012
tags:
  - task
---

# TASK-063 — Dispute Open Workflow

Status: NOT STARTED

Phase: 6 ([[Phase 06 Payment Adjustments]])

## Objective

Mark a confirmed payment as disputed without financial deduction.

## Source Documents

- [[Refunds Disputes Chargebacks]]
- [[Payments]]
- [[Business Rules]]
- [[Audit Logs]]

## Dependencies

[[TASK-045 Payment Service]], [[TASK-012 Audit Event Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Dispute Open/Under Review; original payment immutable; linked payment_adjustment; audit. Open dispute excluded from CB/RF until debit/refund.

### Excluded

Reducing revenue because a dispute was opened. Replacing original success.

## Database Changes

payment_adjustments.

## Backend

Mark as Dispute action.

## Frontend

None (UI is TASK-069).

## Authorization

Admin/Compliance adjustment workflow; Staff no.

## Business Rules

BR-005, BR-023, BR-024.

## Error Handling

N/A

## Tests

### Unit

Dispute open does not change outstanding/CB/RF.

### Integration

Adjustment row created.

### Authorization

Staff denied.

### E2E

E2E-14.

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

[[TASK-064 Full Refunds]]

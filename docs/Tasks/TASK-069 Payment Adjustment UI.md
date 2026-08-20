---
type: task
status: not-started
phase: 6
module: payments
depends_on:
  - TASK-062
  - TASK-068
  - TASK-064
  - TASK-066
tags:
  - task
---

# TASK-069 — Payment Adjustment UI

Status: NOT STARTED

Phase: 6 ([[Phase 06 Payment Adjustments]])

## Objective

Payment detail actions and refund/adjustment view.

## Source Documents

- [[Refunds Disputes Chargebacks]]
- [[Screen Inventory]]

## Dependencies

[[TASK-062 Payment Detail UI]], [[TASK-068 Adjustment History and Notes]], [[TASK-064 Full Refunds]], [[TASK-066 Chargeback Debit Loss]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Mark as Dispute, refunds, chargebacks, reversal, adjustment note. Lifecycle badges without rewriting original success.

### Excluded

Editing original payment financial fields.

## Database Changes

None.

## Backend

Consume adjustment APIs.

## Frontend

Refund/Adjustment view; payment detail actions.

## Authorization

Staff cannot mutate confirmed payments.

## Business Rules

BR-023.

## Error Handling

Show informational dispute vs financial debit clearly.

## Tests

### Unit

N/A

### Integration

N/A

### Authorization

Staff actions hidden and 403 if invoked.

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

[[TASK-070 CBRF Calculation Engine]]

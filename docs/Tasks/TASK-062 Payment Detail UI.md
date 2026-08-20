---
type: task
status: not-started
phase: 5
module: payments
depends_on:
  - TASK-061
  - TASK-046
  - TASK-047
tags:
  - task
---

# TASK-062 — Payment Detail UI

Status: NOT STARTED

Phase: 5 ([[Phase 05 Payments]])

## Objective

Payment detail showing independent financial fields and snapshot.

## Source Documents

- [[Payments]]
- [[Screen Inventory]]
- [[Currency and Conversion]]

## Dependencies

[[TASK-061 Payment List UI]], [[TASK-046 Settlement Conversion Snapshot]], [[TASK-047 Merchant Fee Reconciliation Fields]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Detail of method, status, invoice amount applied, settlement, snapshot, optional fee separately, optional actual received. Lifecycle badges must not rewrite original success (adjustments later).

### Excluded

Editing confirmed fields. Deducting fee from converted settlement in the UI math.

## Database Changes

None.

## Backend

GET payment by id.

## Frontend

Payment detail.

## Authorization

View per matrix. No confirmed-field edits.

## Business Rules

BR-020.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

N/A

### Authorization

Unauthorized 403.

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

[[TASK-063 Dispute Open Workflow]]

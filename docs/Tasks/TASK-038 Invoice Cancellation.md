---
type: task
status: not-started
phase: 4
module: invoicing
depends_on:
  - TASK-036
  - TASK-012
tags:
  - task
---

# TASK-038 — Invoice Cancellation

Status: NOT STARTED

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Cancel with mandatory reason; history retained; no hard delete.

## Source Documents

- [[Invoices]]
- [[Business Rules]]
- [[Audit Logs]]

## Dependencies

[[TASK-036 Invoice Lifecycle]], [[TASK-012 Audit Event Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Status change with reason; cancelled invoices excluded from collectible outstanding unless policy says otherwise.

### Excluded

Hard delete. Staff cancel.

## Database Changes

status + reason.

## Backend

cancel action.

## Frontend

Cancel with reason modal.

## Authorization

Admin yes; Compliance recommend yes; Staff no. Delete invoice: no hard delete.

## Business Rules

BR-012, BR-019.

## Error Handling

Cancel without reason fails.

## Tests

### Unit

N/A

### Integration

Cancel persists history.

### Authorization

Staff cannot cancel.

### E2E

E2E-12.

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

[[TASK-039 PDF Generation]]

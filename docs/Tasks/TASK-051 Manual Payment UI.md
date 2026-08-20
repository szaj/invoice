---
type: task
status: not-started
phase: 5
module: payments
depends_on:
  - TASK-050
tags:
  - task
---

# TASK-051 — Manual Payment UI

Status: NOT STARTED

Phase: 5 ([[Phase 05 Payments]])

## Objective

Record Payment UI on the invoice and manual entry screens.

## Source Documents

- [[Payments]]
- [[Screen Inventory]]

## Dependencies

[[TASK-050 Manual Payment Recording]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Record Payment on invoice; manual payment entry.

### Excluded

Gateway checkout UI.

## Database Changes

None.

## Backend

Consume manual record endpoint. Display-only client math.

## Frontend

Record Payment; Manual payment entry.

## Authorization

Same as TASK-050.

## Business Rules

Fee fields labeled as reconciliation only.

## Error Handling

Show missing-rate Admin message.

## Tests

### Unit

N/A

### Integration

N/A

### Authorization

Unauthorized role cannot submit.

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

[[TASK-052 Stripe Adapter]]

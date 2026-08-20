---
type: task
status: not-started
phase: 5
module: payments
depends_on:
  - TASK-045
tags:
  - task
---

# TASK-061 — Payment List UI

Status: NOT STARTED

Phase: 5 ([[Phase 05 Payments]])

## Objective

Transaction list with company-scoped filters.

## Source Documents

- [[Payments]]
- [[Screen Inventory]]

## Dependencies

[[TASK-045 Payment Service]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Payments transaction list from [[Screen Inventory]].

### Excluded

Adjustment actions (Phase 06).

## Database Changes

None.

## Backend

List/filter endpoint already implied by GET /payments.

## Frontend

Payments list.

## Authorization

Assigned company scope.

## Business Rules

N/A

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

N/A

### Authorization

Staff cannot list unassigned company payments.

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

[[TASK-062 Payment Detail UI]]

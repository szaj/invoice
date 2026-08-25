---
type: task
status: not-started
phase: 8
module: reporting
depends_on:
  - TASK-029
tags:
  - task
---

# TASK-082 — Customer Report

Status: NOT STARTED

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Total invoiced/paid/outstanding by customer and currency.

## Source Documents

- [[Dashboard and Reporting]]
- [[Customers]]

## Dependencies

[[TASK-029 Customer Financial Summary]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Currency-aware grouping.

### Excluded

Single mixed-currency total without conversion label.

## Database Changes

Queries.

## Backend

Customer report endpoint.

## Frontend

Customer Report.

## Authorization

Role-scoped.

## Business Rules

BR-013.

## Error Handling

N/A

## Tests

### Unit

Grouping by currency.

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
- [ ] [[03 Current Implementation Status]] updated
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

[[TASK-083 Company Performance]]

---
type: task
status: not-started
phase: 8
module: reporting
depends_on:
  - TASK-034
  - TASK-060
tags:
  - task
---

# TASK-080 — Outstanding Report

Status: NOT STARTED

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Open invoice balance report.

## Source Documents

- [[Dashboard and Reporting]]
- [[Definitions]]

## Dependencies

[[TASK-034 Invoice Totals]], [[TASK-060 Payment Allocation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Invoice, customer, due date, age, currency, outstanding, company, staff. Cancelled excluded from collectible outstanding unless policy says otherwise.

### Excluded

Including cancelled as collectible by default.

## Database Changes

Queries.

## Backend

Outstanding report endpoint.

## Frontend

Outstanding Report.

## Authorization

Role-scoped.

## Business Rules

BR-009, BR-019.

## Error Handling

N/A

## Tests

### Unit

Cancelled excluded by default.

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

[[TASK-081 Overdue Aging]]

---
type: task
status: not-started
phase: 8
module: reporting
depends_on:
  - TASK-036
tags:
  - task
---

# TASK-078 — Invoice Report

Status: NOT STARTED

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Invoice report minimum output from section 13.3.

## Source Documents

- [[Dashboard and Reporting]]

## Dependencies

[[TASK-036 Invoice Lifecycle]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Invoice number, customer, company, dates, currency, total, paid, balance, status, staff. Pagination/filter/sort.

### Excluded

Unlabeled mixed-currency grand total.

## Database Changes

Queries/indexes.

## Backend

Parameterized report endpoint.

## Frontend

Invoice Report.

## Authorization

Admin all; Compliance assigned; Staff limited.

## Business Rules

BR-013.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Columns/filters.

### Authorization

Scope tests.

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

[[TASK-079 Payment Report]]

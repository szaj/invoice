---
type: task
status: not-started
phase: 8
module: reporting
depends_on:
  - TASK-080
  - TASK-036
tags:
  - task
---

# TASK-081 — Overdue Aging

Status: NOT STARTED

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Overdue aging buckets 1-30, 31-60, 61-90, 90+ days.

## Source Documents

- [[Dashboard and Reporting]]
- [[02 Current Product Rules]]

## Dependencies

[[TASK-080 Outstanding Report]], [[TASK-036 Invoice Lifecycle]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Outstanding where due date is past and invoice is not paid/cancelled.

### Excluded

Marking draft invoices overdue.

## Database Changes

Queries.

## Backend

Aging report endpoint.

## Frontend

Overdue Aging report.

## Authorization

Role-scoped.

## Business Rules

BR-018.

## Error Handling

N/A

## Tests

### Unit

Bucket tests.

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

[[TASK-082 Customer Report]]

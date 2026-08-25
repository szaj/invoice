---
type: task
status: not-started
phase: 8
module: reporting
depends_on:
  - TASK-079
tags:
  - task
---

# TASK-086 — Currency Report

Status: NOT STARTED

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Invoice totals by invoice currency and settlement totals by settlement currency.

## Source Documents

- [[Dashboard and Reporting]]
- [[Currency and Conversion]]

## Dependencies

[[TASK-079 Payment Report]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Currency report.

### Excluded

Collapsing currencies without labels.

## Database Changes

Queries.

## Backend

Currency report endpoint.

## Frontend

Currency Report.

## Authorization

Role-scoped.

## Business Rules

BR-013.

## Error Handling

N/A

## Tests

### Unit

Separate currency totals.

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

[[TASK-087 Compliance Report]]

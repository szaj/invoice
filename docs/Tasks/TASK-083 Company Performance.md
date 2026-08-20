---
type: task
status: not-started
phase: 8
module: reporting
depends_on:
  - TASK-077
tags:
  - task
---

# TASK-083 — Company Performance

Status: NOT STARTED

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Invoice and settlement KPIs by company.

## Source Documents

- [[Dashboard and Reporting]]
- [[Companies and Brands]]

## Dependencies

[[TASK-077 Dashboard KPIs]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Company performance report.

### Excluded

Treating reporting group as the owning company.

## Database Changes

Queries.

## Backend

Company performance endpoint.

## Frontend

Company Performance report.

## Authorization

Admin all; others assigned.

## Business Rules

Ownership remains original company.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

N/A

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

[[TASK-084 Staff Performance]]

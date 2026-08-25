---
type: task
status: not-started
phase: 9
module: ops
depends_on:
  - TASK-077
tags:
  - task
---

# TASK-098 — Performance Hardening

Status: NOT STARTED

Phase: 9 ([[Phase 09 Hardening and Deployment]])

## Objective

Meet list pagination and page/API p95 guidance under normal load; reports remain usable.

## Source Documents

- [[Security]]
- [[Dashboard and Reporting]]

## Dependencies

[[TASK-077 Dashboard KPIs]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Server-side pagination/filtering/sorting; indexes; large reports as jobs if needed.

### Excluded

Loading unbounded lists.

## Database Changes

Indexes on company_id, customer_id, invoice number, status, dates, transaction IDs, report filters.

## Backend

Query/index work.

## Frontend

Responsive lists.

## Authorization

N/A

## Business Rules

p95 target under ~2 seconds for standard authenticated pages/API under normal load.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Basic performance checks on list/report endpoints.

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

[[TASK-099 Queue Hardening]]

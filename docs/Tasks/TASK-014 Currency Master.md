---
type: task
status: not-started
phase: 2
module: currency
depends_on:
  - TASK-013
tags:
  - task
---

# TASK-014 — Currency Master

Status: NOT STARTED

Phase: 2 ([[Phase 02 Financial Foundation]])

## Objective

Create the global currency catalog with defaults USD, AED, PKR, GBP, AUD.

## Source Documents

- [[Currency and Conversion]]
- [[Data Model]]
- [[Settings]]

## Dependencies

[[TASK-013 Core System Settings]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

code, name, symbol, decimal precision, active status; Admin add/disable.

### Excluded

Company enablement. Rate versions. Live FX.

## Database Changes

currencies.

## Backend

GET/POST/PATCH currencies.

## Frontend

Currencies list/create/edit/disable.

## Authorization

Admin only for create/disable.

## Business Rules

Disabled currencies remain for historical display later. BR-011.

## Error Handling

N/A

## Tests

### Unit

Default five currencies present.

### Integration

Currency CRUD.

### Authorization

Non-Admin cannot create currencies.

### E2E

E2E-09 precursor.

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

[[TASK-015 Company Currency Configuration]]

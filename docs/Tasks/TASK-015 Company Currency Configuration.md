---
type: task
status: not-started
phase: 2
module: currency
depends_on:
  - TASK-007
  - TASK-014
tags:
  - task
---

# TASK-015 — Company Currency Configuration

Status: NOT STARTED

Phase: 2 ([[Phase 02 Financial Foundation]])

## Objective

Allow each company to enable a subset of globally active currencies and choose a default invoice currency.

## Source Documents

- [[Currency and Conversion]]
- [[Companies and Brands]]
- [[Data Model]]

## Dependencies

[[TASK-007 Company CRUD]], [[TASK-014 Currency Master]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

company_currencies; default flag.

### Excluded

Payment settlement currencies. Using globally disabled currencies on new documents.

## Database Changes

company_currencies.

## Backend

Company currency subresource.

## Frontend

Company currency settings.

## Authorization

Admin manages company currencies.

## Business Rules

BR-002.

## Error Handling

Reject enabling an inactive global currency.

## Tests

### Unit

N/A

### Integration

Subset persistence.

### Authorization

Cannot enable inactive global currency.

### E2E

E2E-09.

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

[[TASK-016 Fixed Conversion Rate Schema]]

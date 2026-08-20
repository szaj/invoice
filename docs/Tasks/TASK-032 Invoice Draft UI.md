---
type: task
status: not-started
phase: 4
module: invoicing
depends_on:
  - TASK-031
tags:
  - task
---

# TASK-032 — Invoice Draft UI

Status: NOT STARTED

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Invoice list/filter and create/edit draft screens.

## Source Documents

- [[Invoices]]
- [[Screen Inventory]]

## Dependencies

[[TASK-031 Invoice Draft Service]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

List/filter, create/edit draft, view. Internal notes never presented as customer-visible.

### Excluded

PDF/email/payment actions.

## Database Changes

None.

## Backend

Consume draft APIs. Totals display-only until TASK-034 exists.

## Frontend

Invoices list and draft editor.

## Authorization

Assigned company scope.

## Business Rules

Internal notes never printed or emailed (enforced later on PDF/email).

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

N/A

### Authorization

Company scope on list.

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

[[TASK-033 Invoice Line Items]]

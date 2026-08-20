---
type: task
status: not-started
phase: 3
module: customers
depends_on:
  - TASK-023
tags:
  - task
---

# TASK-024 — Customer List and Form UI

Status: NOT STARTED

Phase: 3 ([[Phase 03 Customers]])

## Objective

Customer list/search/filter, create, and edit screens.

## Source Documents

- [[Customers]]
- [[Screen Inventory]]

## Dependencies

[[TASK-023 Customer CRUD Service]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

List/search/filter, create, edit from [[Screen Inventory]].

### Excluded

Profile page (TASK-026). Mixing currencies in any totals shown here.

## Database Changes

None.

## Backend

Consume TASK-023 APIs. Revalidate on the server.

## Frontend

Customers list/create/edit.

## Authorization

Assigned company scope.

## Business Rules

BR-013 if any amounts are shown.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

N/A

### Authorization

Staff only sees assigned-company customers.

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

[[TASK-025 Customer Company Relationships]]

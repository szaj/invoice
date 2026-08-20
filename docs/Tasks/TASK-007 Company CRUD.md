---
type: task
status: not-started
phase: 1
module: companies
depends_on:
  - TASK-005
  - TASK-002
tags:
  - task
---

# TASK-007 — Company CRUD

Status: NOT STARTED

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Create, edit, activate, and deactivate companies/brands.

## Source Documents

- [[Companies and Brands]]
- [[Data Model]]
- [[Settings]]
- [[Screen Inventory]]

## Dependencies

[[TASK-005 Roles and Permissions Model]], [[TASK-002 Database Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Company record fields from [[Companies and Brands]] 5.1 except gateway credentials and currency-subset wiring. Identity, address, status, names.

### Excluded

Payment gateway credentials. Enabling currencies. Issuing invoice numbers.

## Database Changes

companies entity.

## Backend

GET/POST /companies; GET/PATCH /companies/{id}.

## Frontend

Companies list/create/edit/view.

## Authorization

Only Admin creates/edits companies.

## Business Rules

Do not weaken later tenant isolation.

## Error Handling

Invalid company updates rejected.

## Tests

### Unit

N/A

### Integration

Company CRUD.

### Authorization

Non-Admin cannot mutate companies.

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

[[TASK-008 User Company Assignments]]

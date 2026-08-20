---
type: task
status: not-started
phase: 4
module: invoicing
depends_on:
  - TASK-030
  - TASK-023
  - TASK-028
tags:
  - task
---

# TASK-031 — Invoice Draft Service

Status: NOT STARTED

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Create and edit draft invoices via API.

## Source Documents

- [[Invoices]]
- [[Customers]]
- [[API and Integrations]]
- [[Roles and Permissions]]

## Dependencies

[[TASK-030 Invoice Domain Schema]], [[TASK-023 Customer CRUD Service]], [[TASK-028 Customer Duplicate Detection and Status]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

GET/POST /invoices; GET/PATCH /invoices/{id} for drafts. Deactivated customer cannot receive new invoices.

### Excluded

Issue/send. Editing issued financial fields.

## Database Changes

None beyond invoices.

## Backend

Draft CRUD.

## Frontend

None (UI is TASK-032).

## Authorization

Create: Admin/Compliance/Staff. Edit draft: Staff own/assigned.

## Business Rules

BR-001, BR-002.

## Error Handling

Deactivated customer rejected.

## Tests

### Unit

N/A

### Integration

Draft create/update.

### Authorization

Staff cannot edit unassigned drafts.

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

[[TASK-032 Invoice Draft UI]]

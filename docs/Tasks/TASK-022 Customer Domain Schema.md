---
type: task
status: not-started
phase: 3
module: customers
depends_on:
  - TASK-007
  - TASK-002
tags:
  - task
---

# TASK-022 — Customer Domain Schema

Status: NOT STARTED

Phase: 3 ([[Phase 03 Customers]])

## Objective

Create the customer master schema without yet exposing full UI.

## Source Documents

- [[Customers]]
- [[Data Model]]

## Dependencies

[[TASK-007 Company CRUD]], [[TASK-002 Database Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

customers entity and fields from [[Customers]] 7.1. Email not required to create a record.

### Excluded

Hard delete of customers with financial history. Customer portal.

## Database Changes

customers.

## Backend

Persistence model only or internal repository. Public CRUD API may wait for TASK-023.

## Frontend

None required.

## Authorization

N/A yet.

## Business Rules

BR-012 later: financial records never hard-deleted through the UI.

## Error Handling

N/A

## Tests

### Unit

Schema constraints.

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

[[TASK-023 Customer CRUD Service]]

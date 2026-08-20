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

# TASK-028 — Customer Duplicate Detection and Status

Status: NOT STARTED

Phase: 3 ([[Phase 03 Customers]])

## Objective

Warn on likely duplicates and support deactivation that preserves history.

## Source Documents

- [[Customers]]
- [[Business Rules]]

## Dependencies

[[TASK-023 Customer CRUD Service]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Warn on same email, phone, or company/customer name; Admin/Compliance may proceed. Deactivation blocks new invoices (enforced in invoicing) and preserves history.

### Excluded

Silent merge. Hard delete.

## Database Changes

Status field on customers.

## Backend

Non-blocking duplicate warning for Admin/Compliance. Deactivated flag.

## Frontend

Warning UI; status control.

## Authorization

Staff cannot hard-delete.

## Business Rules

Deactivation blocks new invoices while preserving history.

## Error Handling

N/A

## Tests

### Unit

Warning conditions.

### Integration

Deactivate path.

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

[[TASK-029 Customer Financial Summary]]

---
type: task
status: not-started
phase: 4
module: invoicing
depends_on:
  - TASK-041
tags:
  - task
---

# TASK-042 — Email Invoice UI

Status: NOT STARTED

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Email modal for sending the invoice.

## Source Documents

- [[PDF and Email]]
- [[Screen Inventory]]
- [[Notifications]]

## Dependencies

[[TASK-041 Email Delivery]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Recipient defaults to customer email; additional CC/BCC subject to permissions; subject/body from template.

### Excluded

Customer portal.

## Database Changes

None.

## Backend

Consume email action.

## Frontend

Email Modal.

## Authorization

CC/BCC subject to permissions.

## Business Rules

BR-017.

## Error Handling

Show failure without un-issuing the invoice.

## Tests

### Unit

N/A

### Integration

N/A

### Authorization

Unauthorized CC rejected if required by permissions.

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

[[TASK-043 Invoice Duplicate and Print]]

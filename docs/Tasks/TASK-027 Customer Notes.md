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

# TASK-027 — Customer Notes

Status: NOT STARTED

Phase: 3 ([[Phase 03 Customers]])

## Objective

Internal-only customer notes with author and timestamp.

## Source Documents

- [[Customers]]
- [[Data Model]]
- [[Audit Logs]]

## Dependencies

[[TASK-023 Customer CRUD Service]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

customer_notes; internal visibility; author/timestamp.

### Excluded

Customer-visible portal notes. Notes on PDFs.

## Database Changes

customer_notes.

## Backend

Notes create/list on customer.

## Frontend

Notes on profile.

## Authorization

Internal-only. Respect company assignment.

## Business Rules

Notes are internal-only.

## Error Handling

N/A

## Tests

### Unit

Notes omitted from any PDF/email payload fixture.

### Integration

Create/list notes.

### Authorization

Scoped by assignment.

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

[[TASK-028 Customer Duplicate Detection and Status]]

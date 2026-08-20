---
type: task
status: not-started
phase: 7
module: compliance
depends_on:
  - TASK-030
  - TASK-044
tags:
  - task
---

# TASK-071 — Compliance Status Model

Status: NOT STARTED

Phase: 7 ([[Phase 07 Compliance and Audit]])

## Objective

Add compliance statuses Not Reviewed, Under Review, Approved, Flagged on relevant records.

## Source Documents

- [[Compliance]]
- [[Invoices]]
- [[Data Model]]

## Dependencies

[[TASK-030 Invoice Domain Schema]], [[TASK-044 Payment Domain Schema]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Status fields on invoice/payment/customer as specified for review. Start compliance_reviews entity.

### Excluded

Letting Staff change compliance status.

## Database Changes

compliance status fields; compliance_reviews.

## Backend

Status on records.

## Frontend

Status display.

## Authorization

Compliance review: Admin and Compliance yes; Staff no.

## Business Rules

No audit log deletion.

## Error Handling

Staff 403 on status change.

## Tests

### Unit

N/A

### Integration

Status updates.

### Authorization

Staff cannot set compliance status.

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

[[TASK-072 Compliance Review Queue]]

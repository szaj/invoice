---
type: task
status: not-started
phase: 2
module: currency
depends_on:
  - TASK-016
  - TASK-012
tags:
  - task
---

# TASK-017 — Fixed Rate Versioning

Status: NOT STARTED

Phase: 2 ([[Phase 02 Financial Foundation]])

## Objective

Make rate changes prospective and append-only.

## Source Documents

- [[Currency and Conversion]]
- [[Audit Logs]]
- [[Business Rules]]

## Dependencies

[[TASK-016 Fixed Conversion Rate Schema]], [[TASK-012 Audit Event Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

New version expires/closes the previous version but retains it permanently. Audit created/scheduled/activated/expired/superseded.

### Excluded

Recalculating historical payments. In-place edit of a rate used by a payment.

## Database Changes

Append-only versions.

## Backend

Create new version API; never PATCH a historical rate used by payments.

## Frontend

Rate version history list.

## Authorization

Admin only.

## Business Rules

BR-021, BR-022.

## Error Handling

N/A

## Tests

### Unit

Expire-previous-on-create.

### Integration

Version history retained.

### Authorization

N/A

### E2E

E2E-13 precursor.

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

[[TASK-018 Effective Rate Selection]]

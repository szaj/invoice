---
type: task
status: not-started
phase: 2
module: currency
depends_on:
  - TASK-014
  - TASK-015
tags:
  - task
---

# TASK-021 — Currency Disable and Historical Visibility

Status: NOT STARTED

Phase: 2 ([[Phase 02 Financial Foundation]])

## Objective

Disabled currencies remain visible on historical records but cannot be selected for new invoices/payments.

## Source Documents

- [[Currency and Conversion]]
- [[Business Rules]]
- [[Error Handling]]

## Dependencies

[[TASK-014 Currency Master]], [[TASK-015 Company Currency Configuration]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Disable path; new-selection vs historical-display rules.

### Excluded

Rewriting historical currency codes.

## Database Changes

Status flags only.

## Backend

Validation hooks for later invoice/payment create.

## Frontend

Disabled currencies hidden from new-document pickers.

## Authorization

Admin disables; all roles see history later.

## Business Rules

BR-011.

## Error Handling

Currency disabled after invoice: historical invoice remains valid.

## Tests

### Unit

New selection rejects disabled currency.

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

[[TASK-022 Customer Domain Schema]]

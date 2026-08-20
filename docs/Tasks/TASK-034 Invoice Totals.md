---
type: task
status: not-started
phase: 4
module: invoicing
depends_on:
  - TASK-033
  - TASK-019
tags:
  - task
---

# TASK-034 — Invoice Totals

Status: NOT STARTED

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Compute subtotal, discount total, tax total, invoice total, confirmed paid, and outstanding in invoice currency.

## Source Documents

- [[Invoices]]
- [[Definitions]]
- [[Business Rules]]

## Dependencies

[[TASK-033 Invoice Line Items]], [[TASK-019 Money Calculation Utilities]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Server-side totals. Outstanding = invoice total − confirmed payment applications (zero until payments). Do not store a manually edited paid total as source of truth.

### Excluded

Mixed-currency invoice totals.

## Database Changes

Stored totals plus recalculation from items/payments.

## Backend

Recalculate on item change.

## Frontend

Totals panel.

## Authorization

N/A beyond invoice access.

## Business Rules

BR-009.

## Error Handling

N/A

## Tests

### Unit

Totals with zero payments.

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

[[TASK-035 Invoice Numbering]]

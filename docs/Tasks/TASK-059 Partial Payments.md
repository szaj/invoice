---
type: task
status: not-started
phase: 5
module: payments
depends_on:
  - TASK-050
  - TASK-053
tags:
  - task
---

# TASK-059 — Partial Payments

Status: NOT STARTED

Phase: 5 ([[Phase 05 Payments]])

## Objective

Allow multiple payment records per invoice, each applying a specific amount in invoice currency.

## Source Documents

- [[Payments]]
- [[Invoices]]
- [[Business Rules]]

## Dependencies

[[TASK-050 Manual Payment Recording]], [[TASK-053 Stripe Webhook]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Multiple successful payments; each has invoice_amount_applied. Do not yet derive invoice Paid/Partial (TASK-060) if split, but records must coexist.

### Excluded

Manually editing paid totals as source of truth.

## Database Changes

Multiple payments per invoice_id.

## Backend

Create additional payments against an open invoice.

## Frontend

Show multiple payments on invoice when UI exists.

## Authorization

Record permissions as already defined.

## Business Rules

BR-010: cannot apply more than open balance unless authorized overpayment workflow exists.

## Error Handling

Over-application rejected by default.

## Tests

### Unit

Two payments can exist on one invoice.

### Integration

Second payment against remaining balance.

### Authorization

N/A

### E2E

E2E-03 precursor.

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

[[TASK-060 Payment Allocation]]

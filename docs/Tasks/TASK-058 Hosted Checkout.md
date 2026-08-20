---
type: task
status: not-started
phase: 5
module: payments
depends_on:
  - TASK-052
  - TASK-054
  - TASK-046
  - TASK-041
tags:
  - task
---

# TASK-058 — Hosted Checkout

Status: NOT STARTED

Phase: 5 ([[Phase 05 Payments]])

## Objective

Optional hosted checkout/payment links. These are not a customer portal.

## Source Documents

- [[Payments]]
- [[PDF and Email]]
- [[Out of Scope]]

## Dependencies

[[TASK-052 Stripe Adapter]], [[TASK-054 PayPal Adapter]], [[TASK-046 Settlement Conversion Snapshot]], [[TASK-041 Email Delivery]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Create checkout in settlement currency; snapshot active fixed rate when invoice currency differs; optional links on email.

### Excluded

Customer login dashboard. Marking Paid before webhook/status confirmation.

## Database Changes

Pending payment rows with snapshot fields.

## Backend

createPaymentRequest in settlement currency using converted amount from fixed rate.

## Frontend

Payment method selection when sending invoice.

## Authorization

Company-enabled methods only.

## Business Rules

Snapshot stored at request time.

## Error Handling

Gateway timeout keeps Pending/Unknown.

## Tests

### Unit

Checkout uses Admin rate not gateway FX.

### Integration

Pending payment created.

### Authorization

Disabled gateway omitted from new invoice options.

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

[[TASK-059 Partial Payments]]

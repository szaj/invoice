---
type: task
status: not-started
phase: 5
module: payments
depends_on:
  - TASK-018
  - TASK-045
  - TASK-019
tags:
  - task
---

# TASK-046 — Settlement Conversion Snapshot

Status: NOT STARTED

Phase: 5 ([[Phase 05 Payments]])

## Objective

Lock the Admin-defined fixed rate snapshot on confirmed/successful payments.

## Source Documents

- [[Currency and Conversion]]
- [[Payments]]
- [[Business Rules]]

## Dependencies

[[TASK-018 Effective Rate Selection]], [[TASK-045 Payment Service]], [[TASK-019 Money Calculation Utilities]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Store invoice_currency, invoice_amount_applied, settlement_currency, fixed_conversion_rate, rate_source Admin Fixed Rate, rate_effective_at, rate_version_id, converted_settlement_amount. Read-only after Confirmed/Successful.

### Excluded

Recalculating snapshots when Admin later changes rates.

## Database Changes

Snapshot columns on payments.

## Backend

Snapshot on confirm. Corrections via Phase 06 only.

## Frontend

Show snapshot on payment detail later.

## Authorization

Nobody edits locked snapshot fields.

## Business Rules

BR-020, BR-021.

## Error Handling

Missing rate blocks cross-currency confirm. [[Error Handling]]

## Tests

### Unit

Later rate version does not change a confirmed payment.

### Integration

Confirm stores snapshot.

### Authorization

N/A

### E2E

E2E-13.

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

[[TASK-047 Merchant Fee Reconciliation Fields]]

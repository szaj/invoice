---
type: task
status: not-started
phase: 6
module: payments
depends_on:
  - TASK-064
  - TASK-066
  - TASK-067
tags:
  - task
---

# TASK-070 — CB/RF Calculation Engine

Status: NOT STARTED

Phase: 6 ([[Phase 06 Payment Adjustments]])

## Objective

Implement CB/RF as processed refunds + chargeback debits/losses − chargeback won/reversal amounts.

## Source Documents

- [[Refunds Disputes Chargebacks]]
- [[Dashboard and Reporting]]
- [[Business Rules]]

## Dependencies

[[TASK-064 Full Refunds]], [[TASK-066 Chargeback Debit Loss]], [[TASK-067 Chargeback Won Reversal]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Open disputes excluded until financial debit/refund. Net G.Total = Gross Receipts − CB/RF.

### Excluded

Deducting open disputes. Using merchant fees in CB/RF.

## Database Changes

Read model/domain service.

## Backend

Shared calculation used by reports later.

## Frontend

Impact display on payment detail if already available.

## Authorization

N/A

## Business Rules

BR-024, BR-026.

## Error Handling

N/A

## Tests

### Unit

CB/RF formula and dispute exclusion.

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

[[TASK-071 Compliance Status Model]]

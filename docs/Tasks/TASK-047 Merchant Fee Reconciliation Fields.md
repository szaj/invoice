---
type: task
status: not-started
phase: 5
module: payments
depends_on:
  - TASK-044
tags:
  - task
---

# TASK-047 — Merchant Fee Reconciliation Fields

Status: NOT STARTED

Phase: 5 ([[Phase 05 Payments]])

## Objective

Capture optional merchant/processor fee and optional actual received amount as reconciliation data only.

## Source Documents

- [[Payments]]
- [[Definitions]]
- [[Dashboard and Reporting]]
- [[Business Rules]]

## Dependencies

[[TASK-044 Payment Domain Schema]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Optional API-provided or manual fee; actual received not auto-derived by subtracting fee from converted settlement.

### Excluded

Using fee to change invoice balance, fixed rate, converted settlement, or invoice amount.

## Database Changes

processor_fee; actual_received_amount.

## Backend

Store only; excluded from conversion and outstanding formulas.

## Frontend

Display separately on payment detail later.

## Authorization

Staff must not smuggle fee into balance.

## Business Rules

BR-020.

## Error Handling

N/A

## Tests

### Unit

Changing fee does not change outstanding or converted settlement.

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

[[TASK-048 Payment Provider Abstraction]]

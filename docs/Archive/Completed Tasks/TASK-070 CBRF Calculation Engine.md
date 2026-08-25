---
type: task
status: complete
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

Status: COMPLETE

Phase: 6 ([[Phase 06 Payment Adjustments]])

## Objective

Implement CB/RF as processed refunds + chargeback debits/losses − chargeback won/reversal amounts.

## Source Documents

- [[Refunds Disputes Chargebacks]]
- [[Dashboard and Reporting]]
- [[02 Current Product Rules]]

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

- [x] Required schema changes completed
- [x] Backend/domain implementation completed
- [x] UI completed where applicable
- [x] Server-side authorization enforced
- [x] Business rules enforced
- [x] Tests added
- [x] Relevant tests passing
- [x] Documentation updated
- [x] [[03 Current Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

(none — extended existing domain module)

### Files Modified

- `src/domain/money/cbrf.ts` — Gross Receipts, Net G.Total, breakdown, reporting totals, fee exclusion
- `src/domain/money/index.ts` — re-exports
- `src/server/payments/adjustment-ui-actions.ts` — payment-level CB/RF impact
- `src/app/(app)/payments/[id]/page.tsx` — CB/RF impact MetricCard
- `tests/unit/money.test.ts` — TASK-070 formula / dispute / fee / Net G.Total tests
- Current-state docs (Architecture, Status, Plan, Modules, Development Log, Phase 06)

### Migrations

N/A (read-model / domain only)

### APIs

N/A (shared domain helpers for reports later)

### Tests

- `tests/unit/money.test.ts` — CB/RF engine (TASK-070 / BR-024 / BR-026)
- Existing CB/RF contribution tests retained

### Issues

None

### Commit

Not committed (await explicit request)

## Next Recommended Task

[[TASK-071 Compliance Status Model]]

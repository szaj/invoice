---
type: task
status: complete
phase: 6
module: payments
depends_on:
  - TASK-062
  - TASK-068
  - TASK-064
  - TASK-066
tags:
  - task
---

# TASK-069 — Payment Adjustment UI

Status: COMPLETE

Phase: 6 ([[Phase 06 Payment Adjustments]])

## Objective

Payment detail actions and refund/adjustment view.

## Source Documents

- [[Refunds Disputes Chargebacks]]
- [[Screen Inventory]]

## Dependencies

[[TASK-062 Payment Detail UI]], [[TASK-068 Adjustment History and Notes]], [[TASK-064 Full Refunds]], [[TASK-066 Chargeback Debit Loss]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Mark as Dispute, refunds, chargebacks, reversal, adjustment note. Lifecycle badges without rewriting original success.

### Excluded

Editing original payment financial fields.

## Database Changes

None.

## Backend

Consume adjustment APIs.

## Frontend

Refund/Adjustment view; payment detail actions.

## Authorization

Staff cannot mutate confirmed payments.

## Business Rules

BR-023.

## Error Handling

Show informational dispute vs financial debit clearly.

## Tests

### Unit

N/A (authz + impact/lifecycle helpers covered)

### Integration

N/A

### Authorization

Staff actions hidden and 403 if invoked.

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

- `src/app/(app)/payments/[id]/payment-adjustment-panel.tsx`
- `src/server/payments/adjustment-ui-actions.ts`
- `tests/unit/payments-adjustment-ui.test.ts`

### Files Modified

- `src/app/(app)/payments/[id]/page.tsx`
- `src/domain/payments/adjustments.ts`
- `src/components/data/status-badge.tsx`
- `tests/unit/payments-ui-authz.test.ts`
- Active docs: Payments, Refunds Disputes Chargebacks, Phase 06, Implementation Status, Current Plan, Development Log

### Migrations

None.

### APIs

Consumes existing TASK-063–068 routes via server actions (no new routes).

### Tests

- `tests/unit/payments-ui-authz.test.ts` (TASK-069 staff hide / payment.adjust)
- `tests/unit/payments-adjustment-ui.test.ts` (impact labels + available actions)

### Issues

None.

### Commit

Not created (awaiting explicit request).

## Next Recommended Task

[[TASK-070 CBRF Calculation Engine]]

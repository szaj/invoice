---
type: task
status: complete
phase: 5
module: payments
depends_on:
  - TASK-061
  - TASK-046
  - TASK-047
tags:
  - task
---

# TASK-062 — Payment Detail UI

Status: COMPLETE

Phase: 5 ([[Phase 05 Payments]])

## Objective

Payment detail showing independent financial fields and snapshot.

## Source Documents

- [[Payments]]
- [[Screen Inventory]]
- [[Currency and Conversion]]

## Dependencies

[[TASK-061 Payment List UI]], [[TASK-046 Settlement Conversion Snapshot]], [[TASK-047 Merchant Fee Reconciliation Fields]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Detail of method, status, invoice amount applied, settlement, snapshot, optional fee separately, optional actual received. Lifecycle badges must not rewrite original success (adjustments later).

### Excluded

Editing confirmed fields. Deducting fee from converted settlement in the UI math.

## Database Changes

None.

## Backend

GET payment by id.

## Frontend

Payment detail.

## Authorization

View per matrix. No confirmed-field edits.

## Business Rules

BR-020.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

N/A

### Authorization

Unauthorized 403.

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
- [x] [[04 Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

- `src/app/(app)/payments/[id]/page.tsx` — payment detail (method, status, applied, settlement snapshot, fee/actual received separate)

### Files Modified

- `src/server/payments/actions.ts` — `loadPaymentForUi`
- `src/app/(app)/payments/page.tsx` — list row links to detail
- `src/app/(app)/payments/invoice-payments-panel.tsx` — invoice payment rows link to detail
- `tests/unit/payments-service.test.ts` — Staff unassigned-company `getPayment` → 403
- `tests/unit/payments-ui-authz.test.ts` — detail view permission family
- `tests/unit/ui-design-system.test.ts` — `/payments/{id}` nav active vs manual
- Vault: Payments, Screen Inventory, Status, Plan, Phase 05, Home, Development Log

### Migrations

None.

### APIs

Existing `GET /api/payments/{id}` / `getPayment` (no new routes). Read-only detail; no confirmed-field edits.

### Tests

- Authorization: `getPayment` Staff unassigned company → 403 (`GENERIC_FORBIDDEN`)
- Unit: payments-ui-authz (detail view gate), ui-design-system (detail path nav)

### Issues

None. Refund/adjustment lifecycle badges beyond core PENDING/SUCCESSFUL/FAILED remain Phase 06.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-063 Dispute Open Workflow]]

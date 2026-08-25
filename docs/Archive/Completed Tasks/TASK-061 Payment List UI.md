---
type: task
status: complete
phase: 5
module: payments
depends_on:
  - TASK-045
tags:
  - task
---

# TASK-061 — Payment List UI

Status: COMPLETE

Phase: 5 ([[Phase 05 Payments]])

## Objective

Transaction list with company-scoped filters.

## Source Documents

- [[Payments]]
- [[Screen Inventory]]

## Dependencies

[[TASK-045 Payment Service]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Payments transaction list from [[Screen Inventory]].

### Excluded

Adjustment actions (Phase 06).

## Database Changes

None.

## Backend

List/filter endpoint already implied by GET /payments.

## Frontend

Payments list.

## Authorization

Assigned company scope.

## Business Rules

N/A

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

N/A

### Authorization

Staff cannot list unassigned company payments.

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

- `src/app/(app)/payments/page.tsx` — company-scoped payments transaction list
- `src/app/(app)/payments/payment-list-filters.tsx` — company + status filters

### Files Modified

- `src/domain/payments/schema.ts` — `parsePaymentListSearchParams`
- `src/server/payments/actions.ts` — `loadPaymentListOptions`, `loadPaymentsForUi`; revalidate `/payments`
- `src/components/layout/nav-config.ts` — Payments nav; longest-prefix active matching
- `src/components/layout/app-sidebar-nav.tsx` — pass sibling hrefs for active state
- `src/app/(app)/page.tsx` — Payments shortcut
- `tests/unit/payments-ui-authz.test.ts` — list nav + filter parse
- `tests/unit/ui-design-system.test.ts` — `/payments` vs `/payments/manual` active state
- Vault: Screen Inventory, Payments, Status, Plan, Phase 05, Home, Development Log

### Migrations

None.

### APIs

Existing `GET /api/payments` / `listPayments` (no new routes).

### Tests

- Unit: `payments-ui-authz`, `ui-design-system` (nav active)
- Authorization: existing `payments-service` Staff unassigned-company denial; UI gated on `invoice.create` + company scope

### Issues

None. Payment detail UI remains [[TASK-062 Payment Detail UI]].

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-062 Payment Detail UI]]

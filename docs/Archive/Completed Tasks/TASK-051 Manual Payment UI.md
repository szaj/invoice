---
type: task
status: complete
phase: 5
module: payments
depends_on:
  - TASK-050
tags:
  - task
---

# TASK-051 — Manual Payment UI

Status: COMPLETE

Phase: 5 ([[Phase 05 Payments]])

## Objective

Record Payment UI on the invoice and manual entry screens.

## Source Documents

- [[Payments]]
- [[Screen Inventory]]

## Dependencies

[[TASK-050 Manual Payment Recording]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Record Payment on invoice; manual payment entry.

### Excluded

Gateway checkout UI.

## Database Changes

None.

## Backend

Consume manual record endpoint. Display-only client math.

## Frontend

Record Payment; Manual payment entry.

## Authorization

Same as TASK-050.

## Business Rules

Fee fields labeled as reconciliation only.

## Error Handling

Show missing-rate Admin message.

## Tests

### Unit

N/A (authz/nav coverage added under Authorization)

### Integration

N/A (reuses TASK-050 `payments-manual`)

### Authorization

Unauthorized role cannot submit.

### E2E

N/A (shell smoke only)

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

- `src/server/payments/actions.ts` — `recordManualPaymentAction` (wraps TASK-050), form context / conversion preview / collectible invoice loaders
- `src/app/(app)/payments/manual-payment-form.tsx` — shared Record Payment form
- `src/app/(app)/payments/invoice-record-payment-panel.tsx` — invoice detail dialog
- `src/app/(app)/payments/manual/page.tsx` — standalone Manual payment entry
- `src/app/(app)/payments/manual/manual-payment-entry-client.tsx` — invoice picker + form
- `tests/unit/payments-ui-authz.test.ts` — Staff denied; nav gated on `payment.manual.record`

### Files Modified

- `src/app/(app)/invoices/[id]/page.tsx` — Record payment panel for collectible invoices
- `src/components/layout/nav-config.ts` — Operations → Manual payment
- Vault: Payments, Screen Inventory, API, Authorization, Testing, Home, Status, Plan, Phase 05, Dev Log, this task

### Migrations

None.

### APIs

- UI uses server actions → `recordManualPayment` (TASK-050). No new HTTP routes.
- Display-only `previewManualPaymentConversion` (Admin fixed rate; same-currency rate 1). Authoritative snapshot remains on record.

### Tests

- Authorization: Staff denied `payment.manual.record`; Manual payment nav hidden without permission (`payments-ui-authz`); submit path remains TASK-050 Staff 403
- Unit: 327 pass
- Integration: payment suites + full `RUN_DB_INTEGRATION=true test:integration` 59 pass / 4 skipped
- E2E: `shell.spec.ts` unauthenticated→login pass (live auth skipped without credentials)
- `pnpm typecheck` / `lint` / `format:check` / `build` pass

### Issues

US-007 remains OPEN (Staff denied). US-015 overpayment allow remains OPEN. Invoice paid/outstanding allocation remains TASK-060 — UI success copy states balance is unchanged. ADR-009 / ADR-010 / ADR-011 remain OPEN. Gateway checkout / payment list UI remain later tasks.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-052 Stripe Adapter]]

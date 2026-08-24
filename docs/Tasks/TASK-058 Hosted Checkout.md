---
type: task
status: complete
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

Status: COMPLETE

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

Pending payment rows with snapshot fields (existing `payments` schema — no new migration).

## Backend

`createHostedCheckout` → provider `createPaymentRequest` in settlement currency using Admin fixed-rate converted amount; persist PENDING + `GATEWAY_API` + external session/order id. `listHostedCheckoutOptions` omits disabled / uncredentialed / non-hosted methods (BANK_PROCESSOR deferred).

## Frontend

Payment method (+ settlement currency) selection when sending invoice email; injects checkout URL(s) into `paymentLink`. Public return landing at `/payments/checkout/return` (not a portal).

## Authorization

`invoice.create` + company access. Company-enabled methods only.

## Business Rules

Snapshot stored at request time. Does not confirm SUCCESSFUL or allocate invoice balance.

## Error Handling

Provider create failure returns error without SUCCESSFUL payment. Gateway timeout / orphan webhooks remain Pending/Ignored as before.

## Tests

### Unit

Checkout uses Admin rate not gateway FX; Staff may create via `invoice.create`; disabled gateway omitted; company isolation.

### Integration

Pending payment created; disabled gateway omitted from options.

### Authorization

Disabled gateway omitted from new invoice options.

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

- `src/app/api/payments/checkout/route.ts`
- `src/app/api/payments/checkout-options/route.ts`
- `src/app/payments/checkout/return/page.tsx`
- `tests/unit/payments-hosted-checkout.test.ts`
- `tests/integration/payments-hosted-checkout.test.ts`

### Files Modified

- `src/server/payments/payment-service.ts` (`createHostedCheckout`, `listHostedCheckoutOptions`, shared `persistPendingPayment`)
- `src/server/payments/actions.ts`
- `src/domain/payments/schema.ts`, `types.ts`
- `src/app/(app)/invoices/invoice-email-panel.tsx`
- Stripe/PayPal webhook orphan copy (no longer references TASK-058 as pending)

### Migrations

None.

### APIs

- `GET /api/payments/checkout-options?invoiceId=`
- `POST /api/payments/checkout`

### Tests

Unit + integration hosted checkout; full `RUN_DB_INTEGRATION=true test:integration`; typecheck; lint; format:check; build. E2E N/A. Live Stripe/PayPal checkout not exercised.

### Issues

None blocking. Live-provider hosted checkout not performed in this environment.

### Commit

Uncommitted (user did not request commit).

## Next Recommended Task

[[TASK-059 Partial Payments]]

---
type: task
status: complete
phase: 5
module: payments
depends_on:
  - TASK-052
  - TASK-045
  - TASK-012
tags:
  - task
---

# TASK-053 — Stripe Webhook

Status: COMPLETE

Phase: 5 ([[Phase 05 Payments]])

## Objective

Process signed Stripe webhooks idempotently inside the Stripe adapter (`verifyWebhook` / `parseWebhook`). Normalize into application payment events. Duplicate events must not create duplicate payments. Optional BullMQ post-processing so the HTTP handler can return quickly.

## Source Documents

- [[Payments]]
- [[API and Integrations]]
- [[Error Handling]]
- [[Testing]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-052 Stripe Adapter]], [[TASK-045 Payment Service]], [[TASK-012 Audit Event Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Dedicated Stripe webhook Route Handler that only verifies and enqueues/delegates; unique external event ID; idempotent processing; correlation ID; Pino logs without secrets; application audit events on confirm/fail. Map Stripe statuses to Pending/Successful/Failed. Do not mark paid from an unauthenticated client claim.

### Excluded

Duplicate payments on retry. Optimistic Paid on timeout without confirmation.

## Database Changes

payment_events with unique external event ID.

## Backend

Stripe webhook endpoint; parseWebhook; retries safe.

## Frontend

None.

## Authorization

Unsigned webhooks rejected.

## Business Rules

Duplicate webhook → one payment.

## Error Handling

Gateway timeout keeps Pending/Unknown.

## Tests

### Unit

Idempotency on event ID.

### Integration

Signature, retry, duplicate.

### Authorization

Unsigned rejected.

### E2E

E2E-10.

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

- `prisma/migrations/20260824280000_payment_events/migration.sql`
- `src/domain/payments/events/types.ts`
- `src/server/payments/payment-event-repository.ts`
- `src/server/payments/providers/stripe/stripe-webhook-map.ts`
- `src/server/payments/stripe-webhook-queue.ts`
- `src/server/payments/stripe-webhook-service.ts`
- `src/app/api/webhooks/stripe/[companyId]/route.ts`
- `tests/unit/payments-stripe-webhook.test.ts`
- `tests/integration/payments-stripe-webhook.test.ts`

### Files Modified

- `prisma/schema.prisma` — `PaymentEvent`, `PaymentEventProcessingStatus`, relations on `Payment` / `Company`
- `src/server/payments/providers/stripe/{stripe-client,stripe-payment-adapter}.ts` — `parseWebhook` + event object typing
- `src/server/payments/payment-service.ts` — `applyGatewayWebhookPaymentStatus` (WEBHOOK actor; match by external transaction; no invoice balance mutation)
- `src/server/payments/payment-repository.ts` — `getPaymentByExternalTransaction`
- `src/domain/payments/providers/errors.ts` — `PROVIDER_EVENT_UNSUPPORTED`
- `src/domain/auth/https.ts` — public path for `/api/webhooks/stripe/[companyId]`
- Gateway settings copy (request/status + webhooks)
- Unit/integration auth + payment service mocks
- Vault: Payments, API, Testing, Database, Security, ADR-008 note, Home, Status, Plan, Phase 05, Dev Log, this task

### Migrations

`20260824280000_payment_events` — `payment_events` table; unique `(method_code, external_event_id)`; processing status enum; optional `payment_id` for orphan events before TASK-058 creates PENDING payments.

### APIs

- `POST /api/webhooks/stripe/[companyId]` — signature auth via company webhook secret (ADR-022); no session/RBAC. Returns 401 on unsigned/invalid signature; 200 on processed/duplicate/ignored orphan. Does not create payments (TASK-058). Does not mutate invoice paid/outstanding (TASK-060).

### Tests

- Unit: unsigned reject; E2E-10 duplicate event ID → one SUCCESSFUL; orphan event IGNORED; `parseWebhook` mapping; already-terminal idempotency
- Integration: migration present; unsigned 401; confirm once on duplicate; audit `actorType=WEBHOOK`; secrets absent from audit JSON
- Full Playwright Stripe E2E not required (shell smoke only); E2E-10 covered by unit + integration
- `pnpm typecheck` / `lint` / `format:check` / `test` (349) / `RUN_DB_INTEGRATION=true test:integration` (61 pass, 4 skip) / `build` pass

### Issues

Does not create PENDING payments from webhooks (TASK-058). Allocation / invoice paid status remains TASK-060. Full BullMQ worker remains TASK-099 (inline dispatcher used, same pattern as PDF/email). PayPal/bank webhooks remain later. ADR-009 / ADR-010 / ADR-011 remain OPEN. US-007 / US-015 unchanged.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-054 PayPal Adapter]]

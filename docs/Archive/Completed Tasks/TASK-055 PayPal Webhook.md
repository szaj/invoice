---
type: task
status: complete
phase: 5
module: payments
depends_on:
  - TASK-054
  - TASK-045
tags:
  - task
---

# TASK-055 — PayPal Webhook

Status: COMPLETE

Phase: 5 ([[Phase 05 Payments]])

## Objective

Process signed PayPal webhooks idempotently inside the PayPal adapter. Normalize to application statuses. Optional BullMQ post-processing.

## Source Documents

- [[Payments]]
- [[API and Integrations]]
- [[Error Handling]]

## Dependencies

[[TASK-054 PayPal Adapter]], [[TASK-045 Payment Service]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Dedicated PayPal webhook Route Handler; `verifyWebhook` / `parseWebhook`; unique external event ID; idempotent processing; correlation ID; no secret logging.

### Excluded

Duplicate payments. Customer portal.

## Database Changes

payment_events.

## Backend

PayPal webhook endpoint.

## Frontend

None.

## Authorization

Unsigned rejected.

## Business Rules

One payment per event ID.

## Error Handling

Same as Stripe webhook rules.

## Tests

### Unit

Idempotency.

### Integration

Duplicate/retry.

### Authorization

Unsigned rejected.

### E2E

E2E-10 analogue.

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

- `src/server/payments/providers/paypal/paypal-webhook-map.ts`
- `src/server/payments/paypal-webhook-queue.ts`
- `src/server/payments/paypal-webhook-service.ts`
- `src/app/api/webhooks/paypal/[companyId]/route.ts`
- `tests/unit/payments-paypal-webhook.test.ts`
- `tests/integration/payments-paypal-webhook.test.ts`

### Files Modified

- `src/server/payments/providers/paypal/paypal-payment-adapter.ts` — `parseWebhook` (verify + map)
- `src/domain/auth/https.ts` — public path for `/api/webhooks/paypal/[companyId]`
- Gateway settings copy (request/status + webhooks)
- `tests/unit/payments-paypal-adapter.test.ts`, `tests/unit/auth-security.test.ts`
- Vault: Payments, API, Testing, Database, Security, Authorization, ADR-008 note, Home, Status, Plan, Phase 05, Dev Log, this task

### Migrations

None. Reuses TASK-053 `payment_events` with unique `(method_code, external_event_id)`.

### APIs

- `POST /api/webhooks/paypal/[companyId]` — signature auth via company webhook id + credentials (ADR-022); no session/RBAC. Returns 401 on unsigned/invalid signature; 200 on processed/duplicate/ignored orphan/unsupported. Does not create payments (TASK-058). Does not mutate invoice paid/outstanding (TASK-060). Does not rewrite Admin rate snapshots or apply PayPal FX.

### Tests

- Unit: unsigned reject; E2E-10 duplicate event ID → one SUCCESSFUL; orphan IGNORED; event map; already-terminal idempotency
- Integration: unsigned 401; confirm once on duplicate; audit `actorType=WEBHOOK`; secrets absent from audit JSON; settlement snapshot unchanged
- Live PayPal webhook tests: **not run** (fakes only)
- `pnpm typecheck` / `lint` / `format:check` / `test` (365) / `RUN_DB_INTEGRATION=true test:integration` (63 pass, 4 skip) / `build` pass

### Issues

Does not create PENDING payments from webhooks (TASK-058). Allocation remains TASK-060. Full BullMQ worker remains TASK-099 (inline dispatcher). Refunds/disputes remain later. Bank adapter remains TASK-056. ADR-009 / ADR-010 / ADR-011 remain OPEN.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-056 Bank Processor Adapter]]

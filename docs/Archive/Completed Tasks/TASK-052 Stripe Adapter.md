---
type: task
status: complete
phase: 5
module: payments
depends_on:
  - TASK-048
  - TASK-049
tags:
  - task
---

# TASK-052 — Stripe Adapter

Status: COMPLETE

Phase: 5 ([[Phase 05 Payments]])

## Objective

Implement Stripe as a company-specific **adapter** (request/status), not webhook handling. Stripe FX must never override Admin fixed rates. Register via PaymentProvider registry; expose capabilities rather than leaking Stripe names into domain code.

## Source Documents

- [[Payments]]
- [[API and Integrations]]
- [[Security]]
- [[05 Architecture Decisions]]
- [[Engineering Rules]]

## Dependencies

[[TASK-048 Payment Provider Abstraction]], [[TASK-049 Gateway Configuration Per Company]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Enable/disable per company; sandbox/live; hosted/tokenized checkout; no raw card/CVV storage; createPaymentRequest/getPaymentStatus.

### Excluded

Using Stripe FX instead of Admin fixed rates. Storing PAN/CVV. Webhook endpoint (TASK-053).

## Database Changes

Gateway type Stripe on payment_gateway_configs.

## Backend

Stripe adapter methods except parseWebhook.

## Frontend

Operational status indicator Healthy / Configuration Error / Disabled.

## Authorization

Admin configures; Staff never see secrets.

## Business Rules

BR-006.

## Error Handling

N/A

## Tests

### Unit

Adapter tests with sandbox/fixtures; no secret logging.

### Integration

createPaymentRequest uses settlement amount from Admin conversion.

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
- [x] [[04 Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

- `src/server/payments/providers/stripe/{stripe-client,stripe-credentials,stripe-payment-adapter}.ts`
- `src/server/gateway-credentials/resolve-gateway-credentials.ts`
- `src/domain/money/minor-units.ts`
- `tests/unit/payments-stripe-adapter.test.ts`
- `tests/integration/payments-stripe-adapter.test.ts`

### Files Modified

- `src/server/payments/providers/create-payment-provider-registry.ts` — registers Stripe + Manual
- `src/domain/payments/providers/{types,errors}.ts` — companyId on status/webhook inputs; settlementDecimalPrecision + return URLs; provider-neutral error codes; environment on gateway config view
- `src/server/gateway-config/gateway-config-service.ts` — environment on PaymentProviderGatewayConfig
- `src/server/payments/providers/fake-payment-adapter.ts` — accepts extended inputs
- `src/app/(app)/companies/[id]/gateways/gateway-config-form.tsx` — Stripe registered status + secret-key labels
- `src/domain/money/index.ts`, `src/lib/logger.ts`, `package.json` (`stripe`)
- Vault: Payments, API and Integrations, Testing, Database, Security, Authorization, ADR-008 note, Home, Status, Plan, Phase 05, Dev Log, this task

### Migrations

None. Reuses TASK-020/049 `payment_gateway_configs` with `method_code=STRIPE`. No Stripe-specific columns on `payments`.

### APIs

None new. Stripe Checkout/status are adapter-internal. Hosted checkout HTTP remains TASK-058. Webhook Route Handler remains TASK-053.

### Tests

- Unit: registry resolution; disabled/missing credentials fail closed; company credential isolation; no secrets in results/logs; Admin converted settlement → Stripe minor units (no FX recompute); idempotency key stable on retry; status mapping; malformed response fail-safe; sandbox/live key prefix; Manual intact; parseWebhook/refunds/fees deferred
- Integration: encrypted company credentials → createPaymentRequest uses Admin converted settlement; company isolation; disabled/missing credentials fail closed; `providerRegistered` true for Stripe
- Live Stripe network tests: **not run** (fakes only; optional live suite not defined by this task)
- `pnpm typecheck` / `lint` / `format:check` / `test` (344) / `RUN_DB_INTEGRATION=true test:integration` / `build` pass. Live Stripe network tests not run.

### Issues

Webhook business processing (`parseWebhook` + endpoint) remains TASK-053. Refunds/fees/hosted checkout UI remain later. ADR-009 / ADR-010 / ADR-011 remain OPEN. US-007 / US-015 unchanged.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-053 Stripe Webhook]]

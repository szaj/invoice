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

# TASK-048 — Payment Provider Abstraction

Status: COMPLETE

Phase: 5 ([[Phase 05 Payments]])

## Objective

Implement the provider-agnostic PaymentProvider registry, capability model, and adapter boundary. Do not implement live Stripe/PayPal SDKs in this task.

## Source Documents

- [[API and Integrations]]
- [[Payments]]
- [[05 Architecture Decisions]]
- [[Engineering Rules]]

## Dependencies

[[TASK-045 Payment Service]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

PaymentProvider interface and registry; capability flags; operations including createPaymentRequest, getPaymentStatus, parseWebhook, verifyWebhook, refundPayment, getFees, healthCheck — design the TypeScript contract here. Fake + ManualPayment adapters for tests. Normalized Pending/Successful/Failed mapping boundary. No `if (provider === "stripe")` in domain code.

### Excluded

Live Stripe/PayPal/Authorize.Net SDK calls. Card data storage. Implementing a future provider as Version 1 scope. Redesigning invoice/allocation/FX/CB/RF/reporting.

## Database Changes

payment_gateway_configs shape without requiring live secrets yet.

## Backend

Provider registry + capability-based adapters + fake/manual adapters. Domain remains provider-neutral. [[05 Architecture Decisions#ADR-008 — Payment provider architecture|ADR-008]]

## Frontend

None.

## Authorization

Credentials never exposed to Staff.

## Business Rules

BR-008. [[05 Architecture Decisions#ADR-008 — Payment provider architecture|ADR-008]] accepted. Adding Authorize.Net later must be an adapter + registry registration, not a domain rewrite.

## Error Handling

N/A

## Tests

### Unit

Fake adapter contract tests.

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
- [x] [[04 Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

- `src/domain/payments/providers/{types,errors,capabilities,registry}.ts`
- `src/server/payments/providers/{manual-payment-adapter,fake-payment-adapter,create-payment-provider-registry}.ts`
- `tests/unit/payments-provider.test.ts`

### Files Modified

- `prisma/schema.prisma` — comment on `PaymentGatewayConfig` (TASK-048 resolves by methodCode; secrets remain TASK-049)
- `src/server/payments/payment-service.ts` — gateway HTTP remains registry-bound, not inlined
- Vault: Payments, API and Integrations, Testing, Database, Data Model, Security, Authorization, ADR-008, Home, Status, Plan, Phase 05, Dev Log, this task

### Migrations

None. Reuses TASK-020 `payment_gateway_configs` (company, method_code, enabled, settlement currencies). No credential columns.

### APIs

None. Registry is an internal application boundary. Checkout/webhook HTTP remains later tasks.

### Tests

- Unit: Fake contract (create/status/verify/parse/refund/fees/health); Manual denies webhooks/checkout; registry resolution by method code; unregistered Stripe/PayPal/bank; fee retrieval does not change converted settlement; no SDK coupling in core payment files
- Integration: N/A per task; full suite still run
- `pnpm typecheck` / `lint` / `format:check` / `test` (303) / `RUN_DB_INTEGRATION=true test:integration` (56 pass / 4 skipped) / `build` pass

### Issues

None for TASK-048. ADR-009 / ADR-010 / ADR-011 remain OPEN. Encrypted credentials remain TASK-049. Live Stripe/PayPal/bank adapters remain TASK-052/054/056. Authorize.Net is not Version 1.

### Commit

Uncommitted (await user request).

## Next Recommended Task

[[TASK-049 Gateway Configuration Per Company]]

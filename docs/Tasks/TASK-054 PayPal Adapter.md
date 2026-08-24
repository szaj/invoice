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

# TASK-054 — PayPal Adapter

Status: COMPLETE

Phase: 5 ([[Phase 05 Payments]])

## Objective

Implement PayPal as a company-specific **adapter** (request/status), not webhook handling. Register via the PaymentProvider registry with capability flags. PayPal FX must never override Admin fixed rates.

## Source Documents

- [[Payments]]
- [[API and Integrations]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-048 Payment Provider Abstraction]], [[TASK-049 Gateway Configuration Per Company]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Enable/disable per company; sandbox/live; hosted checkout; createPaymentRequest/getPaymentStatus.

### Excluded

Customer PayPal account portal inside this app. Webhook endpoint (TASK-055).

## Database Changes

Gateway type PayPal.

## Backend

PayPal adapter methods except parseWebhook.

## Frontend

Company PayPal settings.

## Authorization

Admin only for credentials.

## Business Rules

BR-011 for disabled gateway historical visibility.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Disable hides from new invoices only (with TASK-058).

### Authorization

N/A

### E2E

E2E-08.

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

- `src/server/payments/providers/paypal/{paypal-client,paypal-credentials,paypal-payment-adapter}.ts`
- `tests/unit/payments-paypal-adapter.test.ts`
- `tests/integration/payments-paypal-adapter.test.ts`

### Files Modified

- `src/server/payments/providers/create-payment-provider-registry.ts` — registers PayPal + Stripe + Manual
- `src/domain/money/{minor-units,index}.ts` — `toProviderAmountDecimalString` for PayPal amount values
- `src/app/(app)/companies/[id]/gateways/gateway-config-form.tsx` — PayPal Client ID / Client secret / Webhook ID labels + adapter-active copy
- `src/lib/logger.ts` — redact PayPal credential fields / env names
- `tests/unit/payments-provider.test.ts` — default registry includes PayPal; bank remains later
- Vault: Payments, API and Integrations, Testing, Database, Security, Authorization, ADR-008 note, Home, Status, Plan, Phase 05, Dev Log, this task

### Migrations

None. Reuses TASK-020/049 `payment_gateway_configs` with `method_code=PAYPAL`. No PayPal-specific columns on `payments`.

### APIs

None new. PayPal Orders create/status are adapter-internal. Hosted checkout HTTP remains TASK-058. Webhook Route Handler remains TASK-055.

### Tests

- Unit: registry resolution; disabled/missing credentials fail closed; company credential isolation; no secrets in results/logs; Admin converted settlement → PayPal decimal amount string (no FX recompute); idempotency key stable on retry; status mapping; sandbox/live API hosts; verifyWebhook unsigned reject; parseWebhook/refunds/fees deferred; Manual/Stripe intact
- Integration: encrypted company credentials → createPaymentRequest uses Admin converted settlement; company isolation; disabled/missing credentials fail closed; `providerRegistered` true for PayPal
- Live PayPal network tests: **not run** (fakes only; optional live suite not defined by this task)
- E2E-08 (disable hides from new invoice options) remains with TASK-058 hosted checkout UI
- `pnpm typecheck` / `lint` / `format:check` / `test` (360) / `RUN_DB_INTEGRATION=true test:integration` (62 pass, 4 skip) / `build` pass

### Issues

Webhook business processing (`parseWebhook` + endpoint) remains TASK-055. Capture orchestration / hosted checkout UI remain TASK-058. Refunds/fees remain later. Bank adapter remains TASK-056. ADR-009 / ADR-010 / ADR-011 remain OPEN. US-007 / US-015 unchanged.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-055 PayPal Webhook]]

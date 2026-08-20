---
type: task
status: not-started
phase: 5
module: payments
depends_on:
  - TASK-045
tags:
  - task
---

# TASK-048 — Payment Provider Abstraction

Status: NOT STARTED

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

- [ ] Required schema changes completed
- [ ] Backend/domain implementation completed
- [ ] UI completed where applicable
- [ ] Server-side authorization enforced
- [ ] Business rules enforced
- [ ] Tests added
- [ ] Relevant tests passing
- [ ] Documentation updated
- [ ] [[04 Implementation Status]] updated
- [ ] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

### Files Modified

### Migrations

### APIs

### Tests

### Issues

### Commit

## Next Recommended Task

[[TASK-049 Gateway Configuration Per Company]]

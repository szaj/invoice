---
type: task
status: not-started
phase: 5
module: payments
depends_on:
  - TASK-048
  - TASK-049
tags:
  - task
---

# TASK-052 — Stripe Adapter

Status: NOT STARTED

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

[[TASK-053 Stripe Webhook]]

---
type: task
status: not-started
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

Status: NOT STARTED

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

[[TASK-054 PayPal Adapter]]

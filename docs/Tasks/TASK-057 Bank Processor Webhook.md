---
type: task
status: not-started
phase: 5
module: payments
depends_on:
  - TASK-056
  - TASK-045
tags:
  - task
---

# TASK-057 — Bank Processor Webhook

Status: NOT STARTED

Phase: 5 ([[Phase 05 Payments]])

## Objective

Process signed bank/card processor webhooks idempotently **where the provider capability supports webhooks**. Use adapter verify/parse, not domain provider-name branches.

## Source Documents

- [[Payments]]
- [[API and Integrations]]
- [[Error Handling]]

## Dependencies

[[TASK-056 Bank Processor Adapter]], [[TASK-045 Payment Service]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Webhook URL per provider type; signature validation; unique external event ID.

### Excluded

Marking Paid without confirmation.

## Database Changes

payment_events.

## Backend

Webhook endpoint for the generic adapter.

## Frontend

None.

## Authorization

Unsigned rejected.

## Business Rules

Idempotency required.

## Error Handling

Timeout keeps Pending/Unknown.

## Tests

### Unit

Idempotency.

### Integration

Duplicate event.

### Authorization

Unsigned rejected.

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

[[TASK-058 Hosted Checkout]]

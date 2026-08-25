---
type: task
status: not-started
phase: 9
module: ops
depends_on:
  - TASK-053
  - TASK-039
  - TASK-090
tags:
  - task
---

# TASK-099 — Queue Hardening

Status: NOT STARTED

Phase: 9 ([[Phase 09 Hardening and Deployment]])

## Objective

Harden **BullMQ + Redis + dedicated worker** processing for webhooks, PDFs, and exports.

## Source Documents

- [[Deployment]]
- [[API and Integrations]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-053 Stripe Webhook]], [[TASK-039 PDF Generation]], [[TASK-090 Report Exports]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Retries, idempotency, failure visibility. Redis is not an authoritative financial store.

### Excluded

Selecting a different queue product without a new ADR. Using Redis as the source of truth for payments or invoices.

## Database Changes

Job metadata as needed.

## Backend

Dedicated worker process consuming BullMQ on Redis, as in [[05 Architecture Decisions#ADR-017 — Deployment|ADR-017]].

## Frontend

UI remains responsive during exports.

## Authorization

N/A

## Business Rules

Webhook still idempotent when retried by worker.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Retry/idempotency tests through the worker path.

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
- [ ] [[03 Current Implementation Status]] updated
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

[[TASK-100 Monitoring]]

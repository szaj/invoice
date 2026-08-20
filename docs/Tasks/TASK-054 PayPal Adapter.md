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

# TASK-054 — PayPal Adapter

Status: NOT STARTED

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

[[TASK-055 PayPal Webhook]]

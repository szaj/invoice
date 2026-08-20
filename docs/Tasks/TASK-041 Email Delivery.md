---
type: task
status: not-started
phase: 4
module: invoicing
depends_on:
  - TASK-039
  - TASK-013
tags:
  - task
---

# TASK-041 — Email Delivery

Status: NOT STARTED

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Email the invoice PDF using company templates through **EmailService → ResendAdapter**. No customer portal.

## Source Documents

- [[PDF and Email]]
- [[Notifications]]
- [[Customers]]
- [[Error Handling]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-039 PDF Generation]], [[TASK-013 Core System Settings]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Per-company sender/reply-to where supported; recipient defaults to customer email; merge fields; PDF attached; optional payment-link placeholder; email_logs. Send via EmailService, not the Resend SDK from invoice modules. Queueable via BullMQ when send should not block HTTP.

### Excluded

Customer account notifications. Calling the Resend SDK from invoice/notification domain modules.

## Database Changes

email_logs.

## Backend

EmailService / EmailProvider / ResendAdapter. Record recipient, subject, sender user, timestamp, status, provider message ID.

## Frontend

None (modal is TASK-042).

## Authorization

Emailing requires valid customer email. BR-017.

## Business Rules

BR-017. Email failure: invoice remains issued; log Failed with retry.

## Error Handling

Missing email blocked. PDF failure does not send a claimed email.

## Tests

### Unit

N/A

### Integration

Send records email_logs.

### Authorization

N/A

### E2E

E2E-02.

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

[[TASK-042 Email Invoice UI]]

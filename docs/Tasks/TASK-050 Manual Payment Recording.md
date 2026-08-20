---
type: task
status: not-started
phase: 5
module: payments
depends_on:
  - TASK-045
  - TASK-046
  - TASK-018
tags:
  - task
---

# TASK-050 — Manual Payment Recording

Status: NOT STARTED

Phase: 5 ([[Phase 05 Payments]])

## Objective

Authorized users record payments received outside an automated gateway.

## Source Documents

- [[Payments]]
- [[Currency and Conversion]]
- [[Roles and Permissions]]
- [[Error Handling]]

## Dependencies

[[TASK-045 Payment Service]], [[TASK-046 Settlement Conversion Snapshot]], [[TASK-018 Effective Rate Selection]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Amount applied, settlement currency, method, reference, date, notes; apply configured fixed rate; optional merchant fee reconciliation only; immutable on confirm; audit event.

### Excluded

Optimistic Paid on gateway timeout. Editing confirmed payments. Fake webhook behavior for manual payments.

## Database Changes

payments rows for manual method.

## Backend

ManualPaymentAdapter / domain path: company authorization, invoice validation, amount validation, Admin fixed-rate snapshot when cross-currency, immutable confirmation, audit. Same core payment domain as gateway payments. No fake webhooks.

## Frontend

None (UI is TASK-051).

## Authorization

Admin/Compliance yes; Staff optional permission (US-007) — do not silently grant it.

## Business Rules

BR-006, BR-010, BR-020.

## Error Handling

Missing rate blocks cross-currency payment.

## Tests

### Unit

Conversion uses Admin rate.

### Integration

Manual confirm locks snapshot.

### Authorization

Staff denied unless optional permission is explicitly configured.

### E2E

E2E-05 precursor.

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

[[TASK-051 Manual Payment UI]]

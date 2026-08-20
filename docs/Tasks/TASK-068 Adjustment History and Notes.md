---
type: task
status: not-started
phase: 6
module: payments
depends_on:
  - TASK-063
tags:
  - task
---

# TASK-068 — Adjustment History and Notes

Status: NOT STARTED

Phase: 6 ([[Phase 06 Payment Adjustments]])

## Objective

Show linked adjustment history and allow adjustment notes.

## Source Documents

- [[Refunds Disputes Chargebacks]]
- [[Audit Logs]]
- [[Settings]]

## Dependencies

[[TASK-063 Dispute Open Workflow]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

History including Adjustment Cancelled retained for audit and excluded from financial totals. Reason codes/settings fields from Refund/Chargeback Settings.

### Excluded

Deleting history. Using cancelled adjustments in CB/RF.

## Database Changes

Existing payment_adjustments; optional attachments metadata if enabled.

## Backend

List adjustments by payment; add note; cancel adjustment with audit.

## Frontend

None required beyond API until TASK-069.

## Authorization

View per payment access; mutations authorized only.

## Business Rules

Original successful payment remains preserved.

## Error Handling

N/A

## Tests

### Unit

Cancelled adjustments excluded from totals.

### Integration

List/cancel.

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

[[TASK-069 Payment Adjustment UI]]

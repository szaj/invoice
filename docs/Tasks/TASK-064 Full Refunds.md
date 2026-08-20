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

# TASK-064 — Full Refunds

Status: NOT STARTED

Phase: 6 ([[Phase 06 Payment Adjustments]])

## Objective

Record a processed full refund as a linked adjustment.

## Source Documents

- [[Refunds Disputes Chargebacks]]
- [[Payments]]
- [[Currency and Conversion]]

## Dependencies

[[TASK-063 Dispute Open Workflow]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Refund Processed deducts refund amount; included in CB/RF on refund effective date; original payment preserved; use merchant actual settlement amount if provided else original payment snapshot, not today's rate.

### Excluded

Overwriting original payment. Using the currently active conversion rate merely because the refund is later.

## Database Changes

payment_adjustments type refund.

## Backend

Record/Process Refund; optional adapter.refundPayment if supported.

## Frontend

None required this cycle besides API.

## Authorization

Authorized roles only.

## Business Rules

BR-023, BR-025.

## Error Handling

N/A

## Tests

### Unit

Snapshot-vs-actual amount rule; original preserved.

### Integration

Refund adjustment created.

### Authorization

Staff denied.

### E2E

E2E-15.

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

[[TASK-065 Partial Refunds]]

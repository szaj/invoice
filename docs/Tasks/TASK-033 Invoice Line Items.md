---
type: task
status: not-started
phase: 4
module: invoicing
depends_on:
  - TASK-031
tags:
  - task
---

# TASK-033 — Invoice Line Items

Status: NOT STARTED

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Add invoice line items with calculated line totals.

## Source Documents

- [[Invoices]]
- [[Data Model]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-031 Invoice Draft Service]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

description required; quantity decimal > 0 default 1; unit rate in invoice currency; optional tax snapshot; line total calculated server-side.

### Excluded

Silently choosing a discount model. Follow [[05 Architecture Decisions#ADR-010 — Discount model|ADR-010]] or block discount until accepted. Changing issued financial lines without version/cancel policy.

## Database Changes

invoice_items.

## Backend

Nested writes on drafts. Client totals display-only.

## Frontend

Line editor on draft invoice.

## Authorization

Same as draft edit permissions.

## Business Rules

Server-side line totals.

## Error Handling

qty <= 0 rejected.

## Tests

### Unit

Line total and qty > 0.

### Integration

Nested write.

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

[[TASK-034 Invoice Totals]]

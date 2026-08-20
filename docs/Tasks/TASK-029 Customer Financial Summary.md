---
type: task
status: not-started
phase: 3
module: customers
depends_on:
  - TASK-026
tags:
  - task
---

# TASK-029 — Customer Financial Summary

Status: NOT STARTED

Phase: 3 ([[Phase 03 Customers]])

## Objective

Show Total Invoiced, Total Paid, Outstanding, Overdue in a currency-aware way.

## Source Documents

- [[Customers]]
- [[Dashboard and Reporting]]
- [[Definitions]]

## Dependencies

[[TASK-026 Customer Profile]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Summary widgets structured so mixed currencies are never naively summed. Live numbers wire as invoices/payments exist.

### Excluded

Converted totals without stored snapshots.

## Database Changes

Read aggregates only.

## Backend

Profile summary/invoices/payments endpoints.

## Frontend

Financial Summary on profile.

## Authorization

Assigned scope.

## Business Rules

BR-013. Outstanding is invoice total minus confirmed payments in invoice currency.

## Error Handling

N/A

## Tests

### Unit

Single-currency math; mixed-currency display rule.

### Integration

N/A

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

[[TASK-030 Invoice Domain Schema]]

---
type: task
status: not-started
phase: 4
module: invoicing
depends_on:
  - TASK-031
  - TASK-035
tags:
  - task
---

# TASK-036 — Invoice Lifecycle

Status: NOT STARTED

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Implement Draft, Issued/Sent, Partially Paid, Paid, Overdue, Cancelled transitions that do not require payments yet, plus overdue rule.

## Source Documents

- [[Invoices]]
- [[Business Rules]]
- [[Testing]]

## Dependencies

[[TASK-031 Invoice Draft Service]], [[TASK-035 Invoice Numbering]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Draft → Issued/Sent or Cancelled. Overdue only for issued/sent/partial with balance > 0 and due date in the past. Due date mandatory unless US-011 due-on-receipt is decided.

### Excluded

Paid/Partial transitions without payment records. Customer portal status.

## Database Changes

status; due date.

## Backend

issue action. Overdue calculation.

## Frontend

Issue action; status filters.

## Authorization

Issue permissions per matrix. Staff cannot cancel (cancellation is TASK-038).

## Business Rules

BR-018, BR-019.

## Error Handling

Illegal transitions rejected.

## Tests

### Unit

Allowed transitions and overdue rule.

### Integration

Issue action.

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

[[TASK-037 Invoice Versions]]

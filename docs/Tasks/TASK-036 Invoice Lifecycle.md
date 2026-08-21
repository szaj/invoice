---
type: task
status: complete
phase: 4
module: invoicing
depends_on:
  - TASK-031
  - TASK-035
tags:
  - task
---

# TASK-036 — Invoice Lifecycle

Status: COMPLETE

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

- [x] Required schema changes completed
- [x] Backend/domain implementation completed
- [x] UI completed where applicable
- [x] Server-side authorization enforced
- [x] Business rules enforced
- [x] Tests added
- [x] Relevant tests passing
- [x] Documentation updated
- [x] [[04 Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

- `src/domain/invoices/lifecycle.ts`
- `src/server/invoices/invoice-lifecycle-service.ts`
- `src/app/api/invoices/[id]/issue/route.ts`
- `src/app/(app)/invoices/invoice-issue-button.tsx`
- `tests/unit/invoices-lifecycle.test.ts`
- `tests/integration/invoices-lifecycle.test.ts`

### Files Modified

- Access helpers (`canIssueDraftInvoice`, `canViewInvoice`); list/get support non-draft statuses
- Status filters on `/invoices`; Issue button on draft detail
- Line-item list readable for issued invoices; draft edit still blocked for non-draft
- Audit: `invoices.issued`, `invoices.overdue_marked`

### Migrations

None — `status` and `due_date` already exist (TASK-030).

### APIs

- `POST /api/invoices/{id}/issue` — Draft → ISSUED; allocates number if null (TASK-035)
- Overdue refresh on list/detail load (BR-018)

### Tests

- Unit: transitions + BR-018 overdue rule
- Integration: issue + number + overdue mark

### Issues

- **Cancel (Draft/Issued → Cancelled)** deferred to [[TASK-038 Invoice Cancellation]] (explicit in TASK-036 auth + TASK-038 ownership). BR-019 collectible-outstanding exclusion for cancelled waits on cancel.
- **Paid / Partially Paid** transitions excluded without payment records.
- **ADR-009 OPEN**: issued financial field edits not implemented (blocked; no silent edits).
- **US-011 undecided**: due date remains mandatory; due-on-receipt not enabled.

### Commit

Not committed in this session.

## Next Recommended Task

[[TASK-037 Invoice Versions]]

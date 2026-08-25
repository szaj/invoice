---
type: task
status: complete
phase: 4
module: invoicing
depends_on:
  - TASK-030
  - TASK-023
  - TASK-028
tags:
  - task
---

# TASK-031 — Invoice Draft Service

Status: COMPLETE

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Create and edit draft invoices via API.

## Source Documents

- [[Invoices]]
- [[Customers]]
- [[API and Integrations]]
- [[Roles and Permissions]]

## Dependencies

[[TASK-030 Invoice Domain Schema]], [[TASK-023 Customer CRUD Service]], [[TASK-028 Customer Duplicate Detection and Status]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

GET/POST /invoices; GET/PATCH /invoices/{id} for drafts. Deactivated customer cannot receive new invoices.

### Excluded

Issue/send. Editing issued financial fields.

## Database Changes

None beyond invoices.

## Backend

Draft CRUD.

## Frontend

None (UI is TASK-032).

## Authorization

Create: Admin/Compliance/Staff. Edit draft: Staff own/assigned.

## Business Rules

BR-001, BR-002.

## Error Handling

Deactivated customer rejected.

## Tests

### Unit

N/A (authz/domain coverage added in unit tests for Staff own/assigned + inactive/currency gates).

### Integration

Draft create/update.

### Authorization

Staff cannot edit unassigned drafts.

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

- `src/domain/invoices/access.ts`
- `src/server/invoices/invoice-draft-service.ts`
- `src/app/api/invoices/route.ts`
- `src/app/api/invoices/[id]/route.ts`
- `tests/unit/invoices-draft.test.ts`
- `tests/integration/invoices-draft.test.ts`

### Files Modified

- `src/domain/invoices/schema.ts` — draft write/list schemas
- `src/domain/invoices/types.ts` — draft error constants
- `src/server/invoices/invoice-repository.ts` — listInvoices
- `src/server/currencies/currency-selection-service.ts` — validateCurrencyCodeForNewDocument
- `src/domain/audit/types.ts` — INVOICE_CREATED / INVOICE_UPDATED
- Vault: task, status, home, plan, phase, Invoices, API, Testing, Dev Log

### Migrations

None (uses TASK-030 `invoices` table).

### APIs

- `GET/POST /api/invoices` — list/create drafts (`invoice.create`; company-scoped)
- `GET/PATCH /api/invoices/{id}` — get/update draft (`invoice.create` / `invoice.edit_draft`)

### Tests

- Unit: Staff own/assigned edit; inactive customer; currency not enabled; create audit
- Integration: create/update; Staff assigned edit allowed; Staff unassigned denied; inactive customer blocked

### Issues

None blocking. Line items, totals, numbering, issue/send, PDF remain later tasks. ADR-009 / ADR-011 remain OPEN.

### Commit

Not committed (awaiting explicit request).

## Next Recommended Task

[[TASK-032 Invoice Draft UI]]

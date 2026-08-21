---
type: task
status: complete
phase: 4
module: invoicing
depends_on:
  - TASK-036
  - TASK-012
tags:
  - task
---

# TASK-038 — Invoice Cancellation

Status: COMPLETE

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Cancel with mandatory reason; history retained; no hard delete.

## Source Documents

- [[Invoices]]
- [[Business Rules]]
- [[Audit Logs]]

## Dependencies

[[TASK-036 Invoice Lifecycle]], [[TASK-012 Audit Event Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Status change with reason; cancelled invoices excluded from collectible outstanding unless policy says otherwise.

### Excluded

Hard delete. Staff cancel.

## Database Changes

status + reason.

## Backend

cancel action.

## Frontend

Cancel with reason modal.

## Authorization

Admin yes; Compliance recommend yes; Staff no. Delete invoice: no hard delete.

## Business Rules

BR-012, BR-019.

## Error Handling

Cancel without reason fails.

## Tests

### Unit

N/A

### Integration

Cancel persists history.

### Authorization

Staff cannot cancel.

### E2E

E2E-12.

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

- `prisma/migrations/20260821220000_invoice_cancellation/migration.sql`
- `src/domain/invoices/cancellation.ts`
- `src/server/invoices/invoice-cancel-service.ts`
- `src/app/api/invoices/[id]/cancel/route.ts`
- `src/app/(app)/invoices/invoice-cancel-controls.tsx`
- `src/server/customers/prisma-customer-financial-summary-source.ts`
- `tests/unit/invoices-cancellation.test.ts`
- `tests/integration/invoices-cancellation.test.ts`

### Files Modified

- `prisma/schema.prisma` — cancellation_reason, cancelled_at, cancelled_by_user_id
- `src/domain/invoices/lifecycle.ts` — Draft/Issued/Overdue → Cancelled
- `src/domain/invoices/types.ts` — cancellation fields on InvoiceRecord
- `src/domain/audit/types.ts` — `invoices.cancelled`
- `src/server/invoices/invoice-repository.ts` — cancelInvoice
- `src/server/invoices/actions.ts` — cancelInvoiceAction
- `src/app/(app)/invoices/[id]/page.tsx` — cancel UI + reason display
- Customer financial summary defaults → Prisma source (BR-019)
- Vault: TASK-038, Status, Home, Plan, Phase 04, Dev Log, Invoices, Data Model, Database, Testing

### Migrations

`20260821220000_invoice_cancellation` — applied via `pnpm prisma:migrate:deploy`.

### APIs

- `POST /api/invoices/[id]/cancel` — body `{ reason }` (mandatory)
- Server Action `cancelInvoiceAction`

### Tests

Unit: allowed states, mandatory reason, Staff denied, totals preserved, audit. Integration: cancel persists row/versions/number; BR-019 summary exclusion. E2E-12 PDF portion deferred to TASK-039 (no PDF yet).

### Issues

None. ADR-009 / cancel-and-reissue not implemented. Partially Paid / Paid not cancellable (payment workflows later).

### Commit

Not committed (await explicit request).

## Next Recommended Task

[[TASK-039 PDF Generation]]

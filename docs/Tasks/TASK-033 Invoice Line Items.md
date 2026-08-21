---
type: task
status: complete
phase: 4
module: invoicing
depends_on:
  - TASK-031
tags:
  - task
---

# TASK-033 — Invoice Line Items

Status: COMPLETE

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

- `prisma/migrations/20260821180000_invoice_line_items/migration.sql`
- `src/domain/invoices/line-items.ts`
- `src/domain/invoices/line-item-schema.ts`
- `src/server/invoices/invoice-line-item-service.ts`
- `src/app/api/invoices/[id]/items/route.ts`
- `src/app/(app)/invoices/invoice-line-items-editor.tsx`
- `tests/unit/invoices-line-items.test.ts`
- `tests/integration/invoices-line-items.test.ts`

### Files Modified

- `prisma/schema.prisma` — `InvoiceItem` + relation
- `src/server/invoices/invoice-repository.ts` — list/replace line items
- `src/server/invoices/actions.ts` — line-item actions
- Draft edit/view UI pages
- `src/domain/audit/types.ts` — `INVOICE_LINE_ITEMS_UPDATED`
- Vault docs

### Migrations

`20260821180000_invoice_line_items` applied via `pnpm prisma:migrate:deploy`.

### APIs

- `GET/PUT /api/invoices/{id}/items` — list/replace draft line items (`invoice.create` / `invoice.edit_draft`)

### Tests

- Unit: line total Decimal math; qty ≤ 0 rejected; discount keys rejected
- Integration: nested replace on draft with server totals

### Issues

Discount blocked (ADR-010 OPEN). Tax snapshot stored but not applied into line total (invoice tax aggregation is TASK-034). ADR-009 / ADR-011 remain OPEN.

### Commit

Not committed (awaiting explicit request).

## Next Recommended Task

[[TASK-034 Invoice Totals]]

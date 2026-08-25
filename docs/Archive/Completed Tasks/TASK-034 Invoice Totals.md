---
type: task
status: complete
phase: 4
module: invoicing
depends_on:
  - TASK-033
  - TASK-019
tags:
  - task
---

# TASK-034 — Invoice Totals

Status: COMPLETE

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Compute subtotal, discount total, tax total, invoice total, confirmed paid, and outstanding in invoice currency.

## Source Documents

- [[Invoices]]
- [[Definitions]]
- [[Business Rules]]

## Dependencies

[[TASK-033 Invoice Line Items]], [[TASK-019 Money Calculation Utilities]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Server-side totals. Outstanding = invoice total − confirmed payment applications (zero until payments). Do not store a manually edited paid total as source of truth.

### Excluded

Mixed-currency invoice totals.

## Database Changes

Stored totals plus recalculation from items/payments.

## Backend

Recalculate on item change.

## Frontend

Totals panel.

## Authorization

N/A beyond invoice access.

## Business Rules

BR-009.

## Error Handling

N/A

## Tests

### Unit

Totals with zero payments.

### Integration

N/A (covered via line-item nested write asserting stored totals).

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

- `prisma/migrations/20260821190000_invoice_totals/migration.sql`
- `src/domain/invoices/totals.ts`
- `src/app/(app)/invoices/invoice-totals-panel.tsx`
- `tests/unit/invoices-totals.test.ts`

### Files Modified

- `prisma/schema.prisma` — stored total columns on `invoices`
- `src/server/invoices/invoice-repository.ts` — persist totals with line replace
- `src/server/invoices/invoice-line-item-service.ts` — recalculate on item change
- Draft view/edit UI totals panels
- Vault docs

### Migrations

`20260821190000_invoice_totals` applied via `pnpm prisma:migrate:deploy`.

### APIs

No new routes. Totals recalculated on `PUT /api/invoices/{id}/items` and returned on invoice GET payloads.

### Tests

- Unit: zero-payment totals; discount forced 0; BR-009 paid applications; Decimal number rejection
- Integration: nested line write persists subtotal/tax/invoice/outstanding

### Issues

Discount total always 0 while ADR-010 OPEN (no discount model invented). Confirmed paid remains 0 until payment applications exist. ADR-009 / ADR-011 remain OPEN.

### Commit

Not committed (awaiting explicit request).

## Next Recommended Task

[[TASK-035 Invoice Numbering]]

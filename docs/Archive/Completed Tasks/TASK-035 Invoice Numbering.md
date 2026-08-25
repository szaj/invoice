---
type: task
status: complete
phase: 4
module: invoicing
depends_on:
  - TASK-010
  - TASK-031
tags:
  - task
---

# TASK-035 — Invoice Numbering

Status: COMPLETE

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Generate invoice numbers using company prefix/sequence; unique within company; never reuse.

## Source Documents

- [[Invoices]]
- [[Companies and Brands]]
- [[Settings]]
- [[Business Rules]]

## Dependencies

[[TASK-010 Company Branding Configuration]], [[TASK-031 Invoice Draft Service]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Independent sequence per company; uniqueness; optional delay until issue if numbering is delayed until issue; optional year component from settings.

### Excluded

Global uniqueness across companies. Reusing cancelled numbers.

## Database Changes

Company sequence fields; unique constraint (company_id, invoice_number).

## Backend

Allocate number transactionally.

## Frontend

Read-only number display.

## Authorization

Users cannot hand-edit to a colliding number.

## Business Rules

BR-003.

## Error Handling

Collision rejected.

## Tests

### Unit

N/A (format helpers covered in unit tests)

### Integration

Two concurrent issues cannot share a number in one company.

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

- `prisma/migrations/20260821200000_invoice_numbering/migration.sql`
- `src/domain/invoices/numbering.ts`
- `src/server/invoices/invoice-number-repository.ts`
- `src/server/invoices/invoice-number-service.ts`
- `tests/unit/invoices-numbering.test.ts`
- `tests/integration/invoices-numbering.test.ts`

### Files Modified

- `prisma/schema.prisma` — `companies.invoice_sequence_next`; `system_settings.invoice_number_include_year`
- Draft create/update APIs/actions reject client `invoiceNumber`
- System settings schema/UI for optional year flag
- Invoice draft view shows read-only number / “Assigned on issue”
- Audit action `invoices.number_assigned`

### Migrations

`20260821200000_invoice_numbering` — applied via `pnpm prisma:migrate:deploy`

### APIs

- `allocateNextInvoiceNumber` / `assignInvoiceNumber` (service + server actions; issue wiring is TASK-036)
- Unique `(company_id, invoice_number)` already from TASK-030

### Tests

- Unit: format + hand-edit rejection
- Integration: concurrent allocation uniqueness; company isolation; assign to draft; hand-edit rejected

### Issues

None. Lifecycle/issue transition remains TASK-036 (calls allocation when issuing).

### Commit

Not committed in this session.

## Next Recommended Task

[[TASK-036 Invoice Lifecycle]]

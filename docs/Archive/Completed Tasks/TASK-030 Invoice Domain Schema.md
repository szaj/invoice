---
type: task
status: complete
phase: 4
module: invoicing
depends_on:
  - TASK-022
  - TASK-015
  - TASK-009
tags:
  - task
---

# TASK-030 — Invoice Domain Schema

Status: COMPLETE

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Create the invoice header schema for a concrete company and customer.

## Source Documents

- [[Invoices]]
- [[Data Model]]
- [[Business Rules]]

## Dependencies

[[TASK-022 Customer Domain Schema]], [[TASK-015 Company Currency Configuration]], [[TASK-009 Tenant Isolation and Company Context]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

invoices fields: company, customer, dates, currency, reference/PO, assigned staff, compliance status placeholder, internal notes, customer notes.

### Excluded

Issuing, numbering lock, PDF, payments.

## Database Changes

invoices.

## Backend

Persistence model.

## Frontend

None required.

## Authorization

Transactional action requires one company.

## Business Rules

BR-001, BR-002.

## Error Handling

N/A

## Tests

### Unit

Company+customer required at schema/validation layer.

### Integration

N/A

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

- `src/domain/invoices/{types,schema}.ts`
- `src/server/invoices/invoice-repository.ts`
- `prisma/migrations/20260821160000_invoice_domain_schema/`
- `tests/unit/invoices-schema.test.ts`

### Files Modified

- `prisma/schema.prisma` — `Invoice` model + status/compliance enums; Company/Customer/User relations
- Prerequisite tests that forbade any `Invoice` model/table
- Audit entity type `invoice` reserved for later writers
- Vault: Invoices, Data Model, Database, Testing, Home, Status, Plan, Phase 04, Dev Log

### Migrations

`20260821160000_invoice_domain_schema` — `invoices` table (Invoices §8.2 header; company+customer required; currency code; dates; optional reference/PO, assigned staff, notes; draft status; compliance placeholder; nullable invoice_number). Applied with `pnpm prisma:migrate:deploy`. No line items, versions, payments, PDF, or public CRUD.

### APIs

None. Internal `PrismaInvoiceStore` only (get/create/update; no hard-delete). Public draft service is TASK-031.

### Tests

Unit: company+customer required (BR-001); currency/dates; rejects line items/totals/payments fields; migration SQL asserts no invoice_items/payments. Prerequisite architecture/db tests updated to allow Invoice, still forbid Payment.

### Issues

BR-002 company enablement of currency is enforced at draft service (TASK-031), not in this schema-only task. Numbering lock remains TASK-035. Totals remain TASK-034. ADR-009 / ADR-011 remain OPEN.

### Commit

Uncommitted (await explicit commit request).

## Next Recommended Task

[[TASK-031 Invoice Draft Service]]

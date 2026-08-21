---
type: task
status: complete
phase: 3
module: customers
depends_on:
  - TASK-007
  - TASK-002
tags:
  - task
---

# TASK-022 — Customer Domain Schema

Status: COMPLETE

Phase: 3 ([[Phase 03 Customers]])

## Objective

Create the customer master schema without yet exposing full UI.

## Source Documents

- [[Customers]]
- [[Data Model]]

## Dependencies

[[TASK-007 Company CRUD]], [[TASK-002 Database Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

customers entity and fields from [[Customers]] 7.1. Email not required to create a record.

### Excluded

Hard delete of customers with financial history. Customer portal.

## Database Changes

customers.

## Backend

Persistence model only or internal repository. Public CRUD API may wait for TASK-023.

## Frontend

None required.

## Authorization

N/A yet.

## Business Rules

BR-012 later: financial records never hard-deleted through the UI.

## Error Handling

N/A

## Tests

### Unit

Schema constraints.

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

`src/domain/customers/{types,schema}.ts`, `src/server/customers/customer-repository.ts`, `prisma/migrations/20260821000000_customer_domain_schema/`, `tests/unit/customers-schema.test.ts`.

### Files Modified

Prisma `Customer` model + `CustomerType` / `CustomerStatus` enums; User/Company relations; prerequisite tests that previously forbade any `Customer` model; [[Customers]], [[Data Model]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 03 Customers]], [[06 Development Log]], [[TASK-022 Customer Domain Schema]].

### Migrations

`20260821000000_customer_domain_schema` — `customers` table (Customers §7.1 fields; email optional; soft ACTIVE/INACTIVE; optional default company preference; tags array; created/updated by). Applied with `pnpm prisma:migrate:deploy`. No `customer_companies`, invoices, payments, public CRUD API, or customer portal.

### APIs

None. Internal `PrismaCustomerStore` only (get/create/update/setStatus; no hard-delete). Public CRUD is TASK-023.

### Tests

Unit: email optional; required name/type; ISO country; currency code; tags; rejects later-task fields; migration SQL asserts no `customer_companies`. `pnpm typecheck` / `lint` / `format:check` / `test` (189) / `RUN_DB_INTEGRATION=true test:integration` (39 passed, 4 skipped) / `build` pass. Integration/Authorization/E2E N/A per task.

### Issues

Authorization and company-scoped CRUD remain TASK-023. Multi-company linkage is TASK-025. ADR-011 remains OPEN. No product assumption on payment-preference enum values (free text).

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-023 Customer CRUD Service]]

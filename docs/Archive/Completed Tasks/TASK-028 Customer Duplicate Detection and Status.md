---
type: task
status: complete
phase: 3
module: customers
depends_on:
  - TASK-023
tags:
  - task
---

# TASK-028 — Customer Duplicate Detection and Status

Status: COMPLETE

Phase: 3 ([[Phase 03 Customers]])

## Objective

Warn on likely duplicates and support deactivation that preserves history.

## Source Documents

- [[Customers]]
- [[Business Rules]]

## Dependencies

[[TASK-023 Customer CRUD Service]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Warn on same email, phone, or company/customer name; Admin/Compliance may proceed. Deactivation blocks new invoices (enforced in invoicing) and preserves history.

### Excluded

Silent merge. Hard delete.

## Database Changes

Status field on customers (already present from TASK-022; no new migration).

## Backend

Non-blocking duplicate warning for Admin/Compliance. Deactivated flag (`INACTIVE` status). Invoice gate helper for later invoicing.

## Frontend

Warning UI; status control.

## Authorization

Staff cannot hard-delete. Staff cannot acknowledge duplicate warnings. Soft-deactivate remains Admin (`customer.delete`).

## Business Rules

Deactivation blocks new invoices while preserving history (gate helper; invoicing enforcement deferred).

## Error Handling

N/A

## Tests

### Unit

Warning conditions.

### Integration

Deactivate path.

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

- `src/domain/customers/duplicates.ts`
- `tests/unit/customers-duplicates.test.ts`
- `tests/integration/customers-duplicates.test.ts`

### Files Modified

- `src/domain/customers/schema.ts` — optional `acknowledgeDuplicates` (not persisted)
- `src/domain/customers/types.ts` — duplicate warning code
- `src/server/customers/customer-repository.ts` — `findPotentialDuplicates`
- `src/server/customers/customer-service.ts` — create/update duplicate gate; `assertCustomerActiveForNewInvoice`
- `src/server/customers/actions.ts` — surface duplicates + acknowledge capability
- `src/app/api/customers/route.ts` / `[id]/route.ts` — 409 payload with `code`/`duplicates`
- `src/app/(app)/customers/customer-form.tsx` — warning UI
- `src/app/(app)/customers/[id]/customer-status-controls.tsx` — clearer soft-status copy
- Vault: Customers, API, Authorization, Testing, Home, Status, Plan, Phase 03, Dev Log

### Migrations

None (customer `status` already exists).

### APIs

- `POST /api/customers` and `PATCH /api/customers/{id}` return `409` with `code: CUSTOMER_DUPLICATE_WARNING` and `duplicates[]` when a match exists and `acknowledgeDuplicates` is not true.
- Admin/Compliance may retry with `acknowledgeDuplicates: true`. Staff acknowledgement → `403`.
- Soft status via existing `POST /api/customers/{id}/status` (Admin).

### Tests

- Unit: match conditions, ack role gate, create/update 409, soft-deactivate + invoice gate.
- Integration: duplicate warn → Admin ack create → soft-deactivate preserves row.

### Issues

Invoice create path does not yet call `assertCustomerActiveForNewInvoice` (no invoicing module). Gate is ready for invoice tasks.

### Commit

Uncommitted (await explicit commit request).

## Next Recommended Task

[[TASK-029 Customer Financial Summary]]

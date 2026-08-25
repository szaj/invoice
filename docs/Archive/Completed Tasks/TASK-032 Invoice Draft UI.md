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

# TASK-032 — Invoice Draft UI

Status: COMPLETE

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Invoice list/filter and create/edit draft screens.

## Source Documents

- [[Invoices]]
- [[Screen Inventory]]

## Dependencies

[[TASK-031 Invoice Draft Service]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

List/filter, create/edit draft, view. Internal notes never presented as customer-visible.

### Excluded

PDF/email/payment actions.

## Database Changes

None.

## Backend

Consume draft APIs. Totals display-only until TASK-034 exists.

## Frontend

Invoices list and draft editor.

## Authorization

Assigned company scope.

## Business Rules

Internal notes never printed or emailed (enforced later on PDF/email).

## Error Handling

N/A

## Tests

### Unit

N/A (company-scope list authz covered in draft unit tests).

### Integration

N/A

### Authorization

Company scope on list.

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

- `src/server/invoices/actions.ts`
- `src/app/(app)/invoices/page.tsx`
- `src/app/(app)/invoices/new/page.tsx`
- `src/app/(app)/invoices/[id]/page.tsx`
- `src/app/(app)/invoices/[id]/edit/page.tsx`
- `src/app/(app)/invoices/invoice-draft-form.tsx`
- `src/app/(app)/invoices/invoice-list-filters.tsx`

### Files Modified

- `src/domain/invoices/schema.ts` — list searchParams helpers
- `src/components/currencies/new-document-currency-picker.tsx` — `valueMode: "code"`
- `src/app/(app)/app-header.tsx` / `page.tsx` — Invoices nav
- `tests/unit/invoices-draft.test.ts` — company-scope list authz
- Vault: task, status, home, plan, phase, Invoices, Screen Inventory, Testing, Authorization, Dev Log

### Migrations

None.

### APIs

Consumes TASK-031 `/api/invoices` via Server Actions (no new routes).

### Tests

- Unit: company-scoped draft list denies unassigned company filter
- typecheck / lint / format / unit / build pass

### Issues

None blocking. Line items (TASK-033), totals (TASK-034), numbering, issue/PDF/payments remain later. ADR-009 / ADR-011 remain OPEN.

### Commit

Not committed (awaiting explicit request).

## Next Recommended Task

[[TASK-033 Invoice Line Items]]

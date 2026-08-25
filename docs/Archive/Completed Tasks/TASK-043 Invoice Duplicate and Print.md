---
type: task
status: complete
phase: 4
module: invoicing
depends_on:
  - TASK-031
  - TASK-039
tags:
  - task
---

# TASK-043 — Invoice Duplicate and Print

Status: COMPLETE

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Duplicate creates a new Draft with copied line items and new ID/number rules. Print via stored PDF.

## Source Documents

- [[Invoices]]

## Dependencies

[[TASK-031 Invoice Draft Service]], [[TASK-039 PDF Generation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Duplicate action; download PDF / print.

### Excluded

Copying invoice numbers. Changing historical PDFs. Copying payments.

## Database Changes

New invoice row (no schema migration).

## Backend

`duplicateInvoice` → new DRAFT via `createDraftInvoice` + line copy via `replaceDraftInvoiceLineItems`. `POST /api/invoices/{id}/duplicate`.

## Frontend

Duplicate button on invoice detail; Download PDF + Print on PDF panel (stored file only).

## Authorization

Same as create invoice (`invoice.create`); company access + `canViewInvoice` on source.

## Business Rules

New draft; numbering rules still apply (number null until issue). No copy of versions/PDFs/emails/payments/cancellation/audit history.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Duplicate is Draft with a new number/id (`tests/integration/invoices-duplicate.test.ts`).

### Authorization

Covered by create + view checks on duplicate path.

### E2E

N/A (shell E2E still applies; E2E-02 live auth optional).

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

- `src/server/invoices/invoice-duplicate-service.ts`
- `src/app/api/invoices/[id]/duplicate/route.ts`
- `src/app/(app)/invoices/invoice-duplicate-button.tsx`
- `tests/integration/invoices-duplicate.test.ts`

### Files Modified

- `src/domain/audit/types.ts` (`invoices.duplicated`)
- `src/domain/invoices/types.ts` (duplicate/print messages)
- `src/server/invoices/actions.ts` (`duplicateInvoiceAction`)
- `src/app/(app)/invoices/[id]/page.tsx`
- `src/app/(app)/invoices/invoice-pdf-panel.tsx` (Print + download)
- Vault: Home, Implementation Status/Plan, Phase 04, Invoices, PDF and Email, Screen Inventory, API, Development Log, this task

### Migrations

None (new invoice row only).

### APIs

- `POST /api/invoices/{id}/duplicate` — same-origin; returns new draft invoice

### Tests

- Integration: duplicate → DRAFT, null number, copied lines, no versions/PDFs on copy
- `pnpm typecheck` / `lint` / `format:check` / `test` (262) / `test:integration` (53 pass / 4 skipped) / `e2e` (1 pass / 1 skipped) / `build` pass

### Issues

None for TASK-043. ADR-009 / ADR-010 / ADR-011 / US-011 remain OPEN. Print requires a stored PDF (TASK-040); drafts without PDF cannot print until generated after issue.

### Commit

Uncommitted (await user request).

## Next Recommended Task

[[TASK-044 Payment Domain Schema]]

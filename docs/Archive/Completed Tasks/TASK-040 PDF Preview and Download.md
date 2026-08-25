---
type: task
status: complete
phase: 4
module: invoicing
depends_on:
  - TASK-039
tags:
  - task
---

# TASK-040 — PDF Preview and Download

Status: COMPLETE

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Preview and download the stored invoice PDF.

## Source Documents

- [[PDF and Email]]
- [[Screen Inventory]]
- [[Invoices]]

## Dependencies

[[TASK-039 PDF Generation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

PDF preview/download from invoice view. Historical versions retrievable if revised.

### Excluded

Mutating historical PDF bytes.

## Database Changes

None.

## Backend

Authorized download by invoice/file id.

## Frontend

PDF Preview / Export/Print.

## Authorization

Same as invoice access.

## Business Rules

N/A

## Error Handling

Unauthorized download 403.

## Tests

### Unit

N/A

### Integration

N/A

### Authorization

Staff cannot download unassigned invoice PDF.

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

- `src/app/api/invoices/[id]/pdf/files/[fileId]/route.ts`
- `src/app/(app)/invoices/invoice-pdf-panel.tsx`
- `tests/unit/invoices-pdf-download.test.ts`

### Files Modified

- `src/server/invoices/invoice-pdf-service.ts` — `downloadInvoicePdf`
- `src/server/invoices/invoice-file-repository.ts` — `getById`
- `src/server/invoices/actions.ts` — `loadInvoicePdfFilesForUi`
- `src/app/(app)/invoices/[id]/page.tsx` — PDF panel
- `src/domain/invoices/pdf.ts` — forbidden/not-found copy
- Vault: TASK-040, Status, Home, Plan, Phase 04, Dev Log, Invoices, PDF and Email, Screen Inventory, API

### Migrations

None.

### APIs

- `GET /api/invoices/[id]/pdf/files/[fileId]?disposition=inline|attachment` — stream stored PDF bytes
- Existing `GET /api/invoices/[id]/pdf` lists metadata; `POST` generates (TASK-039)

### Tests

Authorization unit: Staff unassigned → 403; assigned Staff receives stored bytes; missing storage object → 404 (no silent regenerate). `pnpm typecheck` / `lint` / `format` / `test` (256) / `build` pass.

### Issues

None. Email remains [[TASK-041 Email Delivery]].

### Commit

Not committed (await explicit request).

## Next Recommended Task

[[TASK-041 Email Delivery]]

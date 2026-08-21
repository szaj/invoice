---
type: task
status: complete
phase: 2
module: currency
depends_on:
  - TASK-014
  - TASK-015
tags:
  - task
---

# TASK-021 — Currency Disable and Historical Visibility

Status: COMPLETE

Phase: 2 ([[Phase 02 Financial Foundation]])

## Objective

Disabled currencies remain visible on historical records but cannot be selected for new invoices/payments.

## Source Documents

- [[Currency and Conversion]]
- [[Business Rules]]
- [[Error Handling]]

## Dependencies

[[TASK-014 Currency Master]], [[TASK-015 Company Currency Configuration]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Disable path; new-selection vs historical-display rules.

### Excluded

Rewriting historical currency codes.

## Database Changes

Status flags only.

## Backend

Validation hooks for later invoice/payment create.

## Frontend

Disabled currencies hidden from new-document pickers.

## Authorization

Admin disables; all roles see history later.

## Business Rules

BR-011.

## Error Handling

Currency disabled after invoice: historical invoice remains valid.

## Tests

### Unit

New selection rejects disabled currency.

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

`src/domain/currencies/selection.ts`, `src/server/currencies/currency-selection-service.ts`, `src/components/currencies/new-document-currency-picker.tsx`, `tests/unit/currency-selection.test.ts`.

### Files Modified

`src/domain/currencies/types.ts` (disabled/new-selection error constants); company currency repository/service/form/page (preserve historically enabled INACTIVE assignments; picker/history copy); settlement form historical copy; Prisma model comments. [[Currency and Conversion]], [[Error Handling]], [[Authorization]], [[Security]], [[API and Integrations]], [[Database]], [[Settings]], [[Testing]], ADR-011 note (still OPEN), [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 02 Financial Foundation]], [[06 Development Log]], [[TASK-021 Currency Disable and Historical Visibility]].

### Migrations

None. Reuses existing `currencies.status` / `currency_status` flags from TASK-014. No new tables or columns.

### APIs

No new public routes. Later invoice/payment callers use:

- `validateCurrencyForNewDocument(companyId, currencyId)` — rejects INACTIVE or company-disabled (BR-002 / BR-011)
- `listCurrenciesForNewDocument(companyId)` — ACTIVE + company-enabled only
- `resolveCurrencyForHistoricalDisplay(code)` — returns INACTIVE catalog metadata without rewriting codes

Admin disable remains TASK-014 `PATCH /api/currencies/{id}` under `currency.manage`. Selection hooks do not require Admin (callers enforce authz).

### Tests

Unit: new selection rejects disabled; company-disabled rejected; picker hides INACTIVE; historical label retains code; server hooks match. Company currency save preserves historically enabled inactive assignments. `pnpm typecheck` / `lint` / `format:check` / `test` (181) / `RUN_DB_INTEGRATION=true test:integration` (39 passed, 4 skipped) / `build` pass. Integration/E2E N/A per task.

### Issues

ADR-011 remains OPEN. Invoice/payment create workflows that call these hooks remain later tasks. No rewriting of historical currency codes.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-022 Customer Domain Schema]]

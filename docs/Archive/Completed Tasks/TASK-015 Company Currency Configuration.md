---
type: task
status: complete
phase: 2
module: currency
depends_on:
  - TASK-007
  - TASK-014
tags:
  - task
---

# TASK-015 — Company Currency Configuration

Status: COMPLETE

Phase: 2 ([[Phase 02 Financial Foundation]])

## Objective

Allow each company to enable a subset of globally active currencies and choose a default invoice currency.

## Source Documents

- [[Currency and Conversion]]
- [[Companies and Brands]]
- [[Data Model]]

## Dependencies

[[TASK-007 Company CRUD]], [[TASK-014 Currency Master]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

company_currencies; default flag.

### Excluded

Payment settlement currencies. Using globally disabled currencies on new documents.

## Database Changes

company_currencies.

## Backend

Company currency subresource.

## Frontend

Company currency settings.

## Authorization

Admin manages company currencies.

## Business Rules

BR-002.

## Error Handling

Reject enabling an inactive global currency.

## Tests

### Unit

N/A

### Integration

Subset persistence.

### Authorization

Cannot enable inactive global currency.

### E2E

E2E-09.

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

`src/domain/companies/company-currency-{types,schema}.ts`, `src/server/companies/company-currency-{repository,service,actions}.ts`, `src/app/api/companies/[id]/currencies/route.ts`, `src/app/(app)/companies/[id]/currencies/{page,company-currency-form}.tsx`, `prisma/migrations/20260820300000_company_currency_configuration/`, `tests/unit/company-currencies.test.ts`, `tests/integration/company-currencies.test.ts`.

### Files Modified

Prisma `CompanyCurrency` model + Company/Currency relations; audit `companies.currencies_updated`; company detail Currencies link; prerequisite integration table assertions (companies-crud, reporting-groups, system-settings, currencies). [[Security]], [[Authorization]], [[API and Integrations]], [[Database]], [[Currency and Conversion]], [[Companies and Brands]], [[Settings]], [[Audit Logs]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 02 Financial Foundation]], ADR-011 note (still OPEN), [[TASK-015 Company Currency Configuration]].

### Migrations

`20260820300000_company_currency_configuration` — `company_currencies` join (`company_id`, `currency_id`, `enabled`, `is_default`). Applied with `pnpm prisma:migrate:deploy`. No fixed rates, settlement currencies, or invoice issuance. ADR-011 remains OPEN.

### APIs

- `GET/PATCH /api/companies/{id}/currencies`

Require `company.write` (Admin). Body: `{ enabledCurrencyIds, defaultCurrencyId }`. Reject enabling globally INACTIVE currencies. Empty enabled set requires null default; non-empty requires default in enabled set. Writes audit `companies.currencies_updated`.

### Tests

Unit: schema default-in-enabled; Admin read + Staff mutate denied; inactive global reject; subset persist + audit. Integration: migration recorded; subset persistence; Staff denied; inactive global rejected; no `fixed_conversion_rates`. `pnpm typecheck` / `lint` / `format:check` / `test` (143) / `RUN_DB_INTEGRATION=true test:integration` (38 passed, 1 skipped) / `build` pass. E2E N/A (E2E-09 remains later invoice flow).

### Issues

ADR-011 remains OPEN. Fixed conversion rates are TASK-016+. Settlement currencies TASK-020. Invoice currency selection on drafts is later invoicing. Reporting currency on `system_settings` is still a free code (not company-default).

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-016 Fixed Conversion Rate Schema]]

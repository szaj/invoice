---
type: task
status: complete
phase: 2
module: currency
depends_on:
  - TASK-016
  - TASK-012
tags:
  - task
---

# TASK-017 — Fixed Rate Versioning

Status: COMPLETE

Phase: 2 ([[Phase 02 Financial Foundation]])

## Objective

Make rate changes prospective and append-only.

## Source Documents

- [[Currency and Conversion]]
- [[Audit Logs]]
- [[Business Rules]]

## Dependencies

[[TASK-016 Fixed Conversion Rate Schema]], [[TASK-012 Audit Event Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

New version expires/closes the previous version but retains it permanently. Audit created/scheduled/activated/expired/superseded.

### Excluded

Recalculating historical payments. In-place edit of a rate used by a payment.

## Database Changes

Append-only versions.

## Backend

Create new version API; never PATCH a historical rate used by payments.

## Frontend

Rate version history list.

## Authorization

Admin only.

## Business Rules

BR-021, BR-022.

## Error Handling

N/A

## Tests

### Unit

Expire-previous-on-create.

### Integration

Version history retained.

### Authorization

N/A

### E2E

E2E-13 precursor.

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

`src/app/(app)/settings/fixed-rates/page.tsx` (version history list).

### Files Modified

`fixed-rate-repository` (transactional create + expire previous), `fixed-rate-service` (lifecycle audits + list), actions, `GET/POST /api/fixed-conversion-rates`, create UI copy, home link, unit/integration tests. [[Security]], [[Authorization]], [[API and Integrations]], [[Database]], [[Currency and Conversion]], [[Settings]], [[Audit Logs]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 02 Financial Foundation]], ADR-011 note, [[TASK-017 Fixed Rate Versioning]].

### Migrations

None new. Reuses `fixed_conversion_rates` from TASK-016 (`status`, `valid_to`). Append-only behavior closes prior ACTIVE rows without deleting or rewriting `fixed_rate`.

### APIs

- `GET /api/fixed-conversion-rates` (optional `fromCurrency` / `toCurrency`) — version history
- `POST /api/fixed-conversion-rates` — create new version; expires prior ACTIVE for the pair

No PATCH of historical rate amounts. Requires `currency.manage` (Admin).

### Tests

Unit: expire-previous-on-create; history retained; scheduled audit when `validFrom` is future. Integration: version history retained with EXPIRED prior + ACTIVE new. `pnpm typecheck` / `lint` / `format:check` / `test` (148) / `RUN_DB_INTEGRATION=true test:integration` (40 passed, 1 skipped) / `build` pass. E2E N/A (E2E-13 precursor).

### Issues

Effective rate selection remains TASK-018. ADR-011 remains OPEN. No payment conversion yet.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-018 Effective Rate Selection]]

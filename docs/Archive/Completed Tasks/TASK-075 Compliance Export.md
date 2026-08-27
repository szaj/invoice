---
type: task
status: complete
phase: 7
module: compliance
depends_on:
  - TASK-072
tags:
  - task
---

# TASK-075 — Compliance Export

Status: COMPLETE

Phase: 7 ([[Phase 07 Compliance and Audit]])

## Objective

Export compliance report if permission is granted.

## Source Documents

- [[Compliance]]
- [[Dashboard and Reporting]]
- [[Audit Logs]]

## Dependencies

[[TASK-072 Compliance Review Queue]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Export with audit of export actions.

### Excluded

Staff export unless later policy grants it (US-009).

## Database Changes

None.

## Backend

Export job/file endpoint.

## Frontend

Export from compliance/report.

## Authorization

Admin yes; Compliance yes; Staff optional — default no until decided.

## Business Rules

Export logged in audit history.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Export audited.

### Authorization

Staff denied by default.

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
- [x] [[03 Current Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

- `src/domain/compliance/export-csv.ts`
- `src/app/api/compliance/export/route.ts`
- `src/app/(app)/compliance/compliance-export-button.tsx`
- `tests/unit/compliance-export.test.ts`
- `tests/integration/compliance-export.test.ts`

### Files Modified

- `src/domain/audit/types.ts` — `compliance.exported` / `compliance_export`
- `src/domain/compliance/types.ts` — `COMPLIANCE_EXPORT_FORBIDDEN`
- `src/server/compliance/compliance-service.ts` — `exportComplianceReport`
- `src/app/(app)/compliance/page.tsx` — Export CSV when `report.export` allowed
- Current-state docs (Compliance, Audit Logs, Architecture, Status, Plan, Home, Dev Log, Phase 07)

### Migrations

None.

### APIs

- `GET /api/compliance/export` — CSV of filtered compliance queue; requires `report.export` + `compliance.review`; audits `compliance.exported`

### Tests

- Unit: Staff denied; Admin/Compliance export + audit; CSV escaping
- Integration: Export audited; Staff denied (`RUN_DB_INTEGRATION=true`)

### Issues

None.

### Commit

Not committed (not requested).

## Next Recommended Task

[[TASK-076 Audit Log Viewer]]

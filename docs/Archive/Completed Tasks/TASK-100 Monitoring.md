---
type: task
status: complete
phase: 9
module: ops
depends_on:
  - TASK-099
tags:
  - task
---

# TASK-100 — Monitoring

Status: COMPLETE

Phase: 9 ([[Phase 09 Hardening and Deployment]])

## Objective

Operational monitoring with **Sentry** plus Admin gateway/webhook health indicators.

## Cursor Implementation Result

### Files Created

- `src/lib/sentry/scrub.ts`, `options.ts`, `capture.ts`
- `src/domain/monitoring/types.ts`
- `src/server/monitoring/monitoring-repository.ts`, `monitoring-service.ts`, `actions.ts`
- `src/app/api/health/route.ts`, `src/app/api/monitoring/operations/route.ts`
- `src/app/(app)/settings/operations/page.tsx`, `operations-health-panel.tsx`
- `src/app/global-error.tsx`
- `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- `tests/unit/monitoring-domain.test.ts`, `monitoring-service.test.ts`, `monitoring-health.test.ts`
- `tests/integration/monitoring-health.test.ts`

### Files Modified

- `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `tsconfig.json`, `scripts/worker.ts`
- `src/components/layout/nav-config.ts`

### APIs

- `GET /api/health` — public load-balancer health
- `GET /api/monitoring/operations` — Admin operational snapshot (`settings.manage`)

## Next Recommended Task

[[TASK-101 Backup and Recovery]]

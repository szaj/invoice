---
type: status
status: approved
tags:
  - task
---

# Current Implementation Status

What **exists now** as capabilities. Documentation alone is not completion. Completed task IDs are listed only as range markers — full task files live under `docs/Archive/Completed Tasks/`.

Status values: NOT STARTED · PLANNED · IN PROGRESS · BLOCKED · DEFERRED · COMPLETE

**DEFERRED** ≠ COMPLETE. Do not treat deferred work as implemented.

Control: [[04 Current Plan]] · [[00 Home]]

## Capability summary

| Area | Status |
| --- | --- |
| Repository / CI / env | implemented (TASK-001) |
| Database (Prisma + Supabase PG) | implemented (TASK-002) |
| Authentication (Supabase Auth identity) | implemented (TASK-003–004) |
| RBAC (Admin / Compliance / Staff) | implemented (TASK-005) |
| User management | implemented (TASK-006) |
| Companies / branding / reporting groups | implemented (TASK-007, 010–011) |
| User–company assignments + tenant context | implemented (TASK-008–009) |
| Audit event foundation (append-only writers) | implemented (TASK-012); viewer implemented (TASK-076) |
| Core system settings | implemented (TASK-013); ADR-011 still OPEN |
| Currencies + company currencies + fixed rates | implemented (TASK-014–018, 021) |
| Money calculation utilities | implemented (TASK-019) |
| Settlement currency configuration | implemented (TASK-020) |
| Customers (CRUD, profile, notes, duplicates, financial summary) | implemented (TASK-022–029) |
| Invoices (draft → issue → versions → cancel → PDF → email → duplicate/print) | implemented through TASK-043 |
| UI/UX design system foundation | implemented (checkpoint before TASK-042) |
| Payments domain + service + snapshots + fees | implemented (TASK-044–047) |
| PaymentProvider abstraction | implemented (TASK-048) |
| Gateway config + credential encryption (ADR-022) | implemented (TASK-049) |
| Manual payments + UI | implemented (TASK-050–051) |
| Stripe adapter + webhook | implemented (TASK-052–053) |
| PayPal adapter + webhook | implemented (TASK-054–055) |
| Bank processor adapter + webhook | **DEFERRED** (TASK-056–057) |
| Hosted checkout | implemented (TASK-058) |
| Partial payments + allocation | implemented (TASK-059–060) |
| Payment list + detail UI | implemented (TASK-061–062) |
| Dispute open workflow | implemented (TASK-063) |
| Full refunds | implemented (TASK-064) |
| Partial refunds | implemented (TASK-065) |
| Chargeback debit/loss | implemented (TASK-066) |
| Chargeback won/reversal | implemented (TASK-067) |
| Adjustment history and notes | implemented (TASK-068) |
| Payment adjustment UI | implemented (TASK-069) |
| CB/RF engine | implemented (TASK-070) |
| Compliance status model | implemented (TASK-071) |
| Compliance review queue | implemented (TASK-072) |
| Compliance notes / reason codes | implemented (TASK-073) |
| Compliance review UI | implemented (TASK-074) |
| Compliance export | implemented (TASK-075) |
| Audit log viewer | implemented (TASK-076) |
| Reporting / dashboard | dashboard KPIs (TASK-077) + invoice report (TASK-078) + payment report (TASK-079) + outstanding report (TASK-080) + overdue aging (TASK-081) + customer report (TASK-082) + company performance (TASK-083) + staff performance (TASK-084) + gateway report (TASK-085) + currency report (TASK-086) + compliance report (TASK-087) + monthly brand matrix (TASK-088) + reporting group rollups (TASK-089) + report exports CSV/XLSX (TASK-090) |
| Notifications | operational email alerts via EmailService (TASK-091); Admin notification toggles UI (TASK-092) |
| Hardening / testing suites / deployment | authorization suite (TASK-093); financial calculation suite (TASK-094); webhook suite (TASK-095); Playwright E2E suite (TASK-096); PDF visual QA suite (TASK-097); list pagination + indexes (TASK-098); BullMQ + Redis + worker queue hardening (TASK-099); Sentry monitoring + Admin gateway/webhook health indicators (TASK-100); daily pg_dump backup scripts + R2 versioning health + restore runbook (TASK-101); staging/UAT Docker + Caddy compose stack (TASK-102); production Docker + Caddy TLS compose stack + env checklist + smoke (TASK-103) |

## Completed ID ranges

- **COMPLETE:** TASK-001 through TASK-103, **except** TASK-056 and TASK-057.
- **DEFERRED:** TASK-056, TASK-057 (no live bank processor until concrete vendor/API).

Dependency check for active tasks: if a dependency ID is in the COMPLETE ranges above, treat it as established. Do **not** open archived task files merely to verify COMPLETE status.

## Version 1 live payment providers

MANUAL · STRIPE · PAYPAL. `BANK_PROCESSOR` config slot only until US-017 is resolved.

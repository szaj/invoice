---
type: architecture
status: approved
tags:
  - architecture
---

# Current Architecture

Authoritative **current** architectural facts for implementation. Historical narrative: [[02 Architecture]] (archived). Accepted decisions: [[05 Architecture Decisions]].

## Stack

| Area | Choice | ADR |
| --- | --- | --- |
| Application | Next.js App Router, TypeScript, Node.js, pnpm | ADR-001, ADR-020 |
| UI | Tailwind, shadcn/ui, React Hook Form, Zod, TanStack Table | ADR-012 |
| Database | Supabase PostgreSQL + Prisma | ADR-002 |
| Identity | Supabase Auth | ADR-003 |
| Authorization | Application DB / domain (not Supabase RLS for app authz) | ADR-003 |
| Money | Prisma Decimal + PostgreSQL NUMERIC/DECIMAL | ADR-004 |
| Jobs | BullMQ + Redis + dedicated worker | ADR-005 |
| Storage | Cloudflare R2 via S3-compatible StorageService | ADR-006 |
| Email | Resend via EmailService / EmailProvider | ADR-007 |
| Payments | PaymentProvider registry + adapters | ADR-008 |
| Gateway credentials | Application-managed envelope encryption | ADR-022 |
| PDF | React-pdf | ADR-013 |
| Logging / monitoring | Pino / Sentry | ADR-014, ADR-015 |
| Backup / recovery | Daily pg_dump + R2 versioning + Supabase PITR (prod) | ADR-024 |
| Tests | Vitest + Playwright | ADR-016 |
| Deploy / CI | Docker + Linux VPS + Caddy; GitHub Actions | ADR-017, ADR-018 |

No separate Express/Nest backend. Domain logic stays out of React components, Route Handlers, and Server Actions.

## Identity vs authorization

```text
authenticated ≠ authorized
```

- **Supabase Auth**: identity only.
- **Application DB/domain**: status, role, permission, company access.
- Roles: Admin, Compliance, Staff + company assignment.
- Admin: all companies. Compliance/Staff: assigned companies only.
- Admin “All Companies” is reporting-only; transactional writes need one concrete company.
- Reporting groups are roll-ups only — not authorization.

Every company-scoped server operation must verify identity → user status → role/permission → company access → operation permission. Frontend hiding is not authorization.

## Money

- Authoritative money uses Prisma Decimal / PostgreSQL NUMERIC. Never JS `number` arithmetic.
- Centralize formulas in the financial domain layer (`src/domain/money`).
- **CB/RF engine (TASK-070):** `computeCbrf` / `computeGrossReceipts` / `computeNetGTotal` / `computeReportingNetTotals`. CB/RF = processed refunds + chargeback debits/losses − won/reversals. Open disputes and merchant fees are excluded. Net G.Total = Gross Receipts − CB/RF (BR-024 / BR-026).
- Admin-defined fixed conversion rates only — no live/market FX.
- Successful payments snapshot `rate_version_id` + `fixed_rate_snapshot`; later rate changes never rewrite history.
- Merchant/processor fees are reconciliation-only; they never change invoice balance, rate, converted settlement, CB/RF, or Net G.Total.

## Financial immutability

Confirmed financial records are not silently edited or hard-deleted. Corrections use versioning, adjustments, refunds, disputes, chargebacks, or reversals. Original SUCCESSFUL payments stay locked; adjustment state lives on linked `payment_adjustments`.

## Payment provider abstraction

```text
Payment Domain → Application Service → PaymentProvider Registry → Adapters
```

- Version 1 **live** providers: MANUAL, STRIPE, PAYPAL.
- `BANK_PROCESSOR` is a config method-code **slot** only until a concrete vendor/API is accepted (TASK-056/057 DEFERRED). Do not invent a fictional bank adapter.
- Provider SDKs, webhooks, credentials, and status mapping stay inside adapters.
- Manual payments use the same domain without fake webhooks.
- Adding a provider must not redesign the payment domain.

## Gateway credentials (ADR-022)

AES-256-GCM application-managed envelope encryption; versioned env KEK keyring. Decrypt only via server-only credential services. APIs return safe metadata only (`credentialsConfigured`), never plaintext or ciphertext material. Never log/audit/Sentry plaintext credentials or KEKs.

## StorageService / EmailService

- **StorageService** → S3-compatible adapter → R2; metadata in PostgreSQL.
- **EmailService** → EmailProvider → Resend. Invoice remains issued if email fails.

## Audit

Append-only **application** `audit_logs`, distinct from Pino and Sentry. Privileged financial/status/settings actions must audit. Never store secrets in audit rows.

`GET /api/audit` is the read-only filtered viewer (TASK-076). Requires `audit.read`. Admin may see all companies (including company-null events); Compliance is limited to assigned companies; Staff is denied (US-010 — no invented grant). Values are re-masked on read. No update/delete APIs. UI: `/audit`.

## Compliance status (TASK-071 / TASK-073)

Shared `compliance_status` on invoices, payments, and customers (`NOT_REVIEWED` / `UNDER_REVIEW` / `APPROVED` / `FLAGGED`). Status changes require `compliance.review` (Admin/Compliance); Staff is denied. Each change appends a `compliance_reviews` row with optional notes, reason codes, resolution notes, and evidence refs. Notes-only events use `POST /api/compliance/notes` without changing status.

## Compliance review queue (TASK-072 / TASK-074 / TASK-075)

`GET /api/compliance/queue` returns unified invoice/payment/customer queue items with filters: company, staff, date, amount, gateway, currency, status. Requires `compliance.review`. Compliance is limited to assigned companies; Admin may see all. UI: `/compliance` queue + `/compliance/{subjectType}/{id}` review detail (approve/flag/notes); Staff has no review actions. `GET /api/compliance/export` returns a CSV of the same filtered queue; requires `report.export` and `compliance.review`; Staff denied by default (US-009); each export writes `compliance.exported` audit.

## Dashboard KPIs (TASK-077)

`GET /api/dashboard` and `/` dashboard UI expose §13.1 KPIs under `dashboard.view` (all roles within scope). Invoice-currency buckets: Total Invoiced, Total Paid, Outstanding, Overdue. Settlement-currency buckets: Converted Settlement from stored payment snapshots; processor fees and actual received separately (BR-020). Counts by invoice status and payment method/status. No unlabeled mixed-currency totals (BR-013). ADR-011 reporting-currency rollup is not invented.

## Invoice Report (TASK-078)

`GET /api/reports/invoices` and `/reports/invoices` expose §13.3 Invoice Report under `report.view`. Columns: invoice number, customer, company, dates, currency, total, paid, balance, status, staff. Server-side pagination, filter, and sort. Admin all companies; Compliance assigned companies; Staff assigned companies and own/assigned invoices only. Amounts remain in original invoice currency — no unlabeled mixed-currency grand total (BR-013). ADR-011 reporting-currency rollup is not invented.

## Operational list pagination (TASK-098)

Invoice (`GET /api/invoices`, `/invoices`), customer (`GET /api/customers`, `/customers`), and payment (`GET /api/payments`, `/payments`) lists are server-side paginated (default 50, max 100). Staff invoice visibility is applied in SQL. Payment list does not load all invoices. Full report datasets use export jobs (TASK-090). p95 target under ~2 seconds for standard authenticated list/report APIs under normal load. Indexes cover invoice number, staff visibility, dates, transaction IDs, and report filters.

## Payment Report (TASK-079)

`GET /api/reports/payments` and `/reports/payments` expose §13.3 Payment Report under `report.view`. Columns: invoice, customer, method, transaction ID, invoice amount applied, stored fixed-rate snapshot, converted settlement, optional processor fee, optional actual received, settlement currency, payment date, status. Uses locked payment snapshots only — never live FX (BR-020/021). Fees remain reconciliation-only (BR-020). Same company/staff scoping as Invoice Report. No unlabeled mixed totals; ADR-011 rollup not invented.

## Outstanding Report (TASK-080)

`GET /api/reports/outstanding` and `/reports/outstanding` expose §13.3 Outstanding Report under `report.view`. Columns: invoice, customer, due date, age (days past due), currency, outstanding, company, staff. Collectible open balances only (`outstandingAmount > 0`); cancelled (and draft) excluded by default (BR-019). Outstanding is the stored confirmed-application balance (BR-009). Same company/staff scoping as Invoice Report. No unlabeled mixed totals; ADR-011 rollup not invented.

## Overdue Aging Report (TASK-081)

`GET /api/reports/overdue-aging` and `/reports/overdue-aging` expose §13.3 Overdue Aging under `report.view`. Buckets: 1–30, 31–60, 61–90, 90+ days past due (BR-018). Totals by invoice currency within each bucket (invoice count + stored outstanding). Draft never aged; paid/cancelled excluded. Same company/staff scoping as Invoice Report. No unlabeled mixed totals; ADR-011 rollup not invented.

## Customer Report (TASK-082)

`GET /api/reports/customers` and `/reports/customers` expose §13.3 Customer Report under `report.view`. Rows: customer, currency, total invoiced, total paid, outstanding, invoice count — grouped by customer × invoice currency. Collectible invoices only (draft/cancelled excluded). Stored confirmed-application balances (BR-009). Same company/staff scoping as Invoice Report. No unlabeled mixed-currency totals (BR-013). ADR-011 reporting-currency rollup not invented.

## Company Performance (TASK-083)

`GET /api/reports/companies` and `/reports/companies` expose §13.3 Company Performance under `report.view`. Rows: owning company with invoice-currency KPIs (invoiced/paid/outstanding/overdue) and settlement-currency KPIs (converted settlement from stored snapshots; fees and actual received separate). Reporting group filters narrow company scope only — never treated as ownership. Same company/staff scoping as Invoice Report. No unlabeled mixed-currency totals (BR-013). ADR-011 reporting-currency rollup not invented.

## Staff Performance (TASK-084)

`GET /api/reports/staff` and `/reports/staff` expose §13.3 Staff Performance under `report.view`. Rows: staff user with invoices created/sent (creator attribution), value invoiced by currency (collectible creator totals), and collections linked to assigned invoices (confirmed payment applications by invoice currency). Commission is not calculated. Admin all companies; Compliance assigned; Staff limited to own created invoices and collections on invoices assigned to them. No unlabeled mixed-currency totals (BR-013). ADR-011 reporting-currency rollup not invented.

## Gateway Report (TASK-085)

`GET /api/reports/gateways` and `/reports/gateways` expose §13.3 Gateway Report under `report.view`. Rows: gateway (method) × settlement currency with transaction count, converted settlement from stored snapshots, optional processor fees and actual received (separate, never deducted — BR-020), failure count, and PROCESSED refund totals/count. Same company/staff scoping as Invoice Report. No unlabeled mixed-currency totals (BR-013). ADR-011 reporting-currency rollup not invented.

## Currency Report (TASK-086)

`GET /api/reports/currencies` and `/reports/currencies` expose §13.3 Currency Report under `report.view`. Invoice totals by invoice currency (invoiced/paid/outstanding/overdue) and settlement totals by settlement currency (converted settlement from stored snapshots; fees and actual received separate — BR-020). Currencies stay labeled — never collapsed without labels (BR-013). Same company/staff scoping as Invoice Report. ADR-011 reporting-currency rollup not invented.

## Compliance Report (TASK-087)

`GET /api/reports/compliance` and `/reports/compliance` expose §13.3 Compliance Report. Requires `report.view` and `compliance.review` (Admin/Compliance). Staff is denied by default. Output: review counts (approved / flagged / pending where pending = not reviewed + under review), counts by subject type, aging buckets (0–30 / 31–60 / 61–90 / 90+) for pending and flagged subjects, and notes references from `compliance_reviews`. Read-only — does not manipulate audit logs. Admin all companies; Compliance assigned only.

## Monthly Brand / CB-RF Matrix (TASK-088)

`GET /api/reports/monthly-brand` and `/reports/monthly-brand` expose §13.3.1 Monthly Brand / CB-RF Report under `report.view`. Spreadsheet-style matrix: January–December + G.Total rows; brand/company columns; Monthly Total; CB/RF; Net G.Total. Gross receipts from SUCCESSFUL payments by payment date; CB/RF from adjustments by effective date using shared `computeCbrf` / `computeNetGTotal` (BR-024 / BR-026). Amounts convert to the configured system reporting currency using stored Admin fixed-rate snapshots — labeled as equivalents (BR-013). Open disputes reported separately in summary; never deducted. Drill-down exposes underlying payment and adjustment IDs. Same company/reporting-group/staff scoping as other reports.

## Reporting Group Rollups (TASK-089)

`GET /api/reports/reporting-groups` and `/reports/reporting-groups` expose reporting-group rollups under `report.view`. Rows aggregate dashboard KPIs (invoice-currency and settlement-currency buckets) and monthly-matrix summary blocks (annual gross, CB/RF, Net G.Total, current month, open disputes) per reporting group for the selected year. Filters: reporting group, company/brand, date range, and §13.2 dimensions as applicable. Group membership intersects with user company assignment — Staff cannot roll up unassigned companies via a group. Transaction ownership stays on member companies; groups never weaken access controls. Matrix amounts use configured reporting currency via stored Admin fixed-rate snapshots (BR-013). ADR-011 reporting-currency rollup not invented.

## Report Exports (TASK-090)

`POST /api/reports/exports` creates a scoped CSV or XLSX export for any Phase 08 tabular report (invoices, payments, outstanding, overdue aging, customers, companies, staff, gateways, currencies, compliance report, monthly brand matrix, reporting group rollups). Generation runs through BullMQ when `REDIS_URL` is set (ADR-005 / TASK-099); otherwise inline. Completed files are stored in StorageService; metadata lives in `report_exports` (filters, row count, totals). Download via `GET /api/reports/exports/{id}/file`; status via `GET /api/reports/exports/{id}`. Requires `report.export` (Admin/Compliance; Staff denied by default — US-009). Compliance report export also requires `compliance.review`. Each export writes `reports.exported` audit (BR-015). UI: Export CSV / Export XLSX on each report page when allowed. Full datasets are fetched server-side — TanStack Table never loads the full financial dataset into the browser.

## Background jobs (TASK-099)

BullMQ + Redis + dedicated worker (`pnpm worker`) when `REDIS_URL` is configured (ADR-005). Queues: Stripe/PayPal webhook post-processing, invoice PDF, invoice email, report exports, operational notifications. Exponential retries (5 attempts); provider webhook idempotency remains on `payment_events`. Operational metadata in `background_jobs` (status, attempts, last error) — PostgreSQL stays authoritative for financial records; Redis is not. Without Redis, inline dispatchers preserve local/test behavior.

## Operational notifications (TASK-091, TASK-092)

Internal operational alerts send through **EmailService** (ADR-007), not provider SDKs from domain modules. Events: invoice email sent/failed; optional payment success/failed; invoice overdue (assigned staff and/or Admin per `system_settings` flags); compliance flagged (Admin + assigned Compliance); gateway configuration/webhook failure (Admin). Emission is best-effort and non-blocking; BullMQ dispatcher when `REDIS_URL` is set (ADR-005 / TASK-099). Notification toggles persist on `system_settings`; Admin configures them at `/settings/notifications` (TASK-092). No customer portal notifications in Version 1.

## Monitoring (TASK-100)

**Sentry** (ADR-015) instruments the Next.js app (`instrumentation.ts` / `instrumentation-client.ts`) and the dedicated worker (`pnpm worker`). `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` are optional; `beforeSend` scrubs credentials and prohibited payment data. Public load-balancer probe: `GET /api/health` (database ping + queue/Sentry status). Admin operational indicators at `/settings/operations` (`settings.manage`): per-company gateway config status, adapter `healthCheck()` results, webhook failure counts from recent `payment_events` rows marked `FAILED`, and backup health (TASK-101).

## Backup and recovery (TASK-101)

Daily automated PostgreSQL dumps via `pnpm backup:database` when `BACKUP_DIR` is set (ADR-024). Artifacts are gzip SQL dumps plus `.last-success.json`; retention controlled by `BACKUP_RETENTION_DAYS`. Production should enable Supabase PITR in addition to application dumps. R2 bucket object versioning protects PDFs/exports; Admin `/settings/operations` reports last dump age and versioning status. `pnpm restore:database` is for staging/UAT drills and blocks production unless `BACKUP_RESTORE_ALLOW_PRODUCTION=true`. Secrets are never backed up as plaintext files.

## Production deployment (TASK-103)

Live operations on **Docker + Caddy + TLS** (ADR-017): `deploy/production/docker-compose.yml` runs Next.js (`runner-web`), worker (`runner-worker`), Redis, and Caddy with automatic HTTPS. Managed Supabase PostgreSQL and R2 stay external. Live Stripe/PayPal credentials per company (ADR-022). Pre-cutover checklist: `pnpm check:production-env -- deploy/production/env`. Post-deploy smoke: `PRODUCTION_SMOKE_URL=… pnpm test:production-smoke`. Daily backups via `pnpm backup:database` when `BACKUP_DIR` is set; enable Supabase PITR (ADR-024). Runbook: [[Deployment]] · `deploy/production/README.md`.

## Staging / UAT deployment (TASK-102)

Production-like acceptance on **Docker + Caddy** (ADR-017): `deploy/staging/docker-compose.yml` runs Next.js (`runner-web`), worker (`runner-worker`), Redis, and Caddy reverse proxy. Managed Supabase PostgreSQL and R2 stay external — UAT uses a dedicated Supabase project and R2 bucket with sandbox payment credentials only. Web container runs `prisma migrate deploy` on start. Post-deploy smoke: `STAGING_SMOKE_URL=… pnpm test:staging-smoke`. Runbook: [[Deployment]] · `deploy/staging/README.md`.

## UI design system

From TASK-042 onward: reuse shared design system and semantic tokens. Do not invent page-specific visual languages. See [[UI UX Design System]] and `.cursor/rules/ui-ux.mdc`.

## Testing / task-execution policy

- Numbered TASKs: read the active TASK first; use Current Architecture / Product Rules only when relevant; do not scan `docs/Archive/**` in normal execution.
- Targeted unit (+ affected integration) tests per TASK; full integration only at phase/checkpoint/release boundaries.
- Playwright E2E: `pnpm test:e2e` (`tests/e2e/`). Coverage registry in `tests/e2e/coverage.ts` maps E2E-01..17 to Playwright specs or Vitest integration sign-off. Live flows need `E2E_ADMIN_*` or `AUTH_TEST_*` credentials.
- See `.cursor/rules/task-execution.mdc` and `.cursor/rules/testing-execution.mdc`.

## Open / deferred architecture items

| Item | Status |
| --- | --- |
| ADR-009 Issued invoice financial edit policy | OPEN |
| ADR-010 Discount model | OPEN |
| ADR-011 Reporting/base currency default | OPEN |
| Exact VPS vendor / DNS | OPEN (operational) |
| Live bank processor adapter | DEFERRED (US-017) |

Unresolved product items: [[Unresolved Source Items]].

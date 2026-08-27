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

## Payment Report (TASK-079)

`GET /api/reports/payments` and `/reports/payments` expose §13.3 Payment Report under `report.view`. Columns: invoice, customer, method, transaction ID, invoice amount applied, stored fixed-rate snapshot, converted settlement, optional processor fee, optional actual received, settlement currency, payment date, status. Uses locked payment snapshots only — never live FX (BR-020/021). Fees remain reconciliation-only (BR-020). Same company/staff scoping as Invoice Report. No unlabeled mixed totals; ADR-011 rollup not invented.

## Outstanding Report (TASK-080)

`GET /api/reports/outstanding` and `/reports/outstanding` expose §13.3 Outstanding Report under `report.view`. Columns: invoice, customer, due date, age (days past due), currency, outstanding, company, staff. Collectible open balances only (`outstandingAmount > 0`); cancelled (and draft) excluded by default (BR-019). Outstanding is the stored confirmed-application balance (BR-009). Same company/staff scoping as Invoice Report. No unlabeled mixed totals; ADR-011 rollup not invented.

## Overdue Aging Report (TASK-081)

`GET /api/reports/overdue-aging` and `/reports/overdue-aging` expose §13.3 Overdue Aging under `report.view`. Buckets: 1–30, 31–60, 61–90, 90+ days past due (BR-018). Totals by invoice currency within each bucket (invoice count + stored outstanding). Draft never aged; paid/cancelled excluded. Same company/staff scoping as Invoice Report. No unlabeled mixed totals; ADR-011 rollup not invented.

## Customer Report (TASK-082)

`GET /api/reports/customers` and `/reports/customers` expose §13.3 Customer Report under `report.view`. Rows: customer, currency, total invoiced, total paid, outstanding, invoice count — grouped by customer × invoice currency. Collectible invoices only (draft/cancelled excluded). Stored confirmed-application balances (BR-009). Same company/staff scoping as Invoice Report. No unlabeled mixed-currency totals (BR-013). ADR-011 reporting-currency rollup not invented.

## UI design system

From TASK-042 onward: reuse shared design system and semantic tokens. Do not invent page-specific visual languages. See [[UI UX Design System]] and `.cursor/rules/ui-ux.mdc`.

## Testing / task-execution policy

- Numbered TASKs: read the active TASK first; use Current Architecture / Product Rules only when relevant; do not scan `docs/Archive/**` in normal execution.
- Targeted unit (+ affected integration) tests per TASK; full integration only at phase/checkpoint/release boundaries.
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

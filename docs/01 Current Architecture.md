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

## Compliance status (TASK-071)

Shared `compliance_status` on invoices, payments, and customers (`NOT_REVIEWED` / `UNDER_REVIEW` / `APPROVED` / `FLAGGED`). Status changes require `compliance.review` (Admin/Compliance); Staff is denied. Each change appends a `compliance_reviews` row (notes/reason codes in TASK-073). Queue/filters are TASK-072.

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

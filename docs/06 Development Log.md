---
type: log
status: approved
tags:
  - architecture
---

# Development Log

Chronological implementation history. Do not fabricate completed work.

## Log Format

### YYYY-MM-DD — TASK-XXX

Work completed:

Files changed:

Database changes:

Tests:

Decisions:

Problems:

Next task:

## Entries

### 2026-08-24 — TASK-046

Work completed:

Locked Admin-defined fixed-rate snapshots on payments (BR-020 / BR-021). Stored invoice/settlement currencies, applied amount, fixed rate, `rate_source`, `rate_effective_at`, `rate_version_id`, and converted settlement. Confirm completes the snapshot without re-resolving a stored rate. Later Admin rate versions do not rewrite historical payments. Processor fees remain excluded from converted settlement. Missing Admin rate still blocks cross-currency create and incomplete-snapshot confirm. No market/gateway FX. No payment UI.

Files changed:

`prisma/schema.prisma`, migration `20260824260000_payment_settlement_snapshot`, `src/domain/payments/{snapshot,types,schema}.ts`, `src/server/payments/{payment-service,payment-repository}.ts`, unit + integration snapshot tests. Updated [[Currency and Conversion]], [[Payments]], [[Data Model]], [[Database]], [[Testing]], [[Error Handling]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 05 Payments]], this log, [[TASK-046 Settlement Conversion Snapshot]].

Database changes:

`payments.rate_effective_at TIMESTAMPTZ` applied via `pnpm prisma:migrate:deploy`.

Tests:

Unit later-rate immutability + same-currency effective time + missing-rate confirm (284). Integration confirm-stores-snapshot / E2E-13 analogue + full suite 56 pass / 4 skipped. `typecheck` / `lint` / `format:check` / `build` pass.

Decisions:

None. Admin fixed-rate architecture unchanged. ADR-009 / ADR-010 / ADR-011 remain OPEN.

Problems:

None for snapshot scope. Payment detail UI remains TASK-062. Merchant fee reconciliation fields remain TASK-047.

Next task:

[[TASK-047 Merchant Fee Reconciliation Fields]]

### 2026-08-24 — TASK-045

Work completed:

Payment domain service on the TASK-044 `payments` schema (ADR-008). Create PENDING, confirm PENDING→SUCCESSFUL, fail PENDING→FAILED, GET list/detail. Server path: authorization → company scope → invoice/customer → settlement enablement → Admin fixed-rate resolution → Decimal conversion (fee excluded) → persist → audit. Confirmed financial fields are not rewritten (BR-004/005). No gateway HTTP, adapters, webhooks, allocation, or UI.

Files changed:

`src/domain/payments/{transitions,access,types,schema,invariants}.ts`, `src/server/payments/{payment-service,payment-repository}.ts`, `src/app/api/payments/**`, `src/domain/audit/types.ts`, unit + integration payment-service tests. Updated [[Payments]], [[API and Integrations]], [[Audit Logs]], [[Testing]], [[Authorization]], [[Error Handling]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 05 Payments]], this log, [[TASK-045 Payment Service]].

Database changes:

None.

Tests:

Unit lock-after-SUCCESSFUL, pending/confirm, Staff write denial (277). Integration create pending/confirm + full suite 55 pass / 4 skipped. `typecheck` / `lint` / `format:check` / `build` pass.

Decisions:

None. ADR-008 followed; ADR-009 / ADR-010 / ADR-011 remain OPEN. Overpayment (US-015) not decided.

Problems:

None for service scope. Snapshot `rate_effective_at` remains TASK-046. Charging/adapters remain later.

Next task:

[[TASK-046 Settlement Conversion Snapshot]]

### 2026-08-21 — TASK-044

Work completed:

Provider-agnostic `payments` domain schema (Payments §10.3 / ADR-008). Prisma `Payment` + PENDING/SUCCESSFUL/FAILED status; Decimal amounts and rate snapshot; optional processor fee and actual received stored separately from converted settlement (BR-020); company/invoice/customer ownership; domain invariants for confirmed immutability (BR-004/005); internal `PrismaPaymentStore` only. No charges, webhooks, allocation, adapters, credentials, or UI.

Files changed:

`prisma/schema.prisma`, migration `20260821250000_payment_domain_schema`, `src/domain/payments/*`, `src/server/payments/payment-repository.ts`, unit + integration schema tests, prerequisite tests that previously forbade `payments`. Updated [[Payments]], [[Data Model]], [[Database]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 05 Payments]], this log, [[TASK-044 Payment Domain Schema]].

Database changes:

`payments` table applied via `pnpm prisma:migrate:deploy`.

Tests:

Unit fee-vs-settlement + immutability + no vendor columns (268). Integration: payments table/columns + full suite 54 pass / 4 skipped. `typecheck` / `lint` / `format:check` / `build` pass.

Decisions:

None. ADR-008 followed; ADR-009 / ADR-010 / ADR-011 remain OPEN.

Problems:

None for schema scope. Payment service / charging remain TASK-045+.

Next task:

[[TASK-045 Payment Service]]

### 2026-08-21 — TASK-043

Work completed:

Invoice Duplicate + Print/Export. `duplicateInvoice` creates a new DRAFT via existing draft + line-item services: copies company/customer/dates/currency/reference/notes/line items; resets id, invoice number (null), status DRAFT, compliance NOT_REVIEWED, payment totals, cancellation, versions, PDFs, email logs. Audits `invoices.duplicated`. `POST /api/invoices/{id}/duplicate` + Duplicate button on invoice detail. Print/Download reuse stored versioned PDF (TASK-040) — no second renderer.

Files changed:

`invoice-duplicate-service.ts`, duplicate API route, `invoice-duplicate-button.tsx`, invoice detail page, `invoice-pdf-panel.tsx` (Print), audit action, integration test. Updated [[Invoices]], [[PDF and Email]], [[Screen Inventory]], [[API and Integrations]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 04 Invoicing]], this log, [[TASK-043 Invoice Duplicate and Print]].

Database changes:

None (new invoice row only).

Tests:

Integration: duplicate → Draft with new id, null number, copied lines, no versions/PDFs. `pnpm typecheck` / `lint` / `format:check` / `test` (262) / `test:integration` (53 pass / 4 skipped) / `e2e` (1 pass / 1 skipped live auth) / `build` pass.

Decisions:

None. ADR-009 / ADR-010 / ADR-011 remain OPEN.

Problems:

Print requires a stored PDF; drafts without a generated PDF cannot print until after issue/generate.

Next task:

[[TASK-044 Payment Domain Schema]]

### 2026-08-21 — TASK-042

Work completed:

Invoice email modal + delivery history on `/invoices/[id]`. Reuses TASK-041 `sendInvoiceEmail` / `listInvoiceEmailLogs` (no provider/PDF/audit duplication). Compose defaults via `prepareInvoiceEmailCompose`. To defaults to customer email (BR-017); subject/body from template merge fields (editable). Optional CC/BCC for actors with `invoice.edit_issued`; Staff CC rejected server-side. Stored PDF attached by server; failure shows error without un-issuing; retry re-opens send. Design system: Dialog, FormField, Alert, StatusBadge, Table, EmptyState.

Files changed:

`invoice-email-panel.tsx`, invoice detail page, email domain helpers, EmailProvider cc/bcc, invoice-email-service/actions/API route, unit tests, login `h1` a11y fix. Updated [[PDF and Email]], [[Screen Inventory]], [[API and Integrations]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 04 Invoicing]], [[UI UX Design System]], this log, [[TASK-042 Email Invoice UI]].

Database changes:

None.

Tests:

Unit 262 (CC authz + list parse). Email integration pass. Full integration 52 pass / 4 skipped. Shell E2E pass (live auth skipped). typecheck / lint / format:check / build pass.

Decisions:

CC/BCC gated by existing `invoice.edit_issued` (no new permission / migration). ADR-009 / ADR-010 / ADR-011 remain OPEN.

Problems:

E2E-02 full Staff create→email path still requires AUTH_TEST_* credentials.

Next task:

[[TASK-043 Invoice Duplicate and Print]]

### 2026-08-21 — UI/UX Foundation Refresh — before TASK-042

Work completed:

Non-numbered presentation checkpoint after TASK-041 and before TASK-042. Established professional reusable SaaS design system (tokens, shell/sidebar, page layout, tables, forms, status badges, feedback, detail patterns). Refreshed representative screens via shared components. Documented that all TASK-042+ frontend work must reuse the system. TASK-041 remains COMPLETE. TASK-042 remains NOT STARTED. No RBAC/tenant/financial/lifecycle/auth architecture changes.

Files changed:

`docs/Technical/UI UX Design System.md`, `.cursor/rules/ui-ux.mdc`, vault cross-links ([[00 Home]], [[03 Implementation Plan]], [[04 Implementation Status]], [[Engineering Rules]], this log), `src/app/globals.css`, `src/components/{ui,layout,data,forms,feedback}/*`, authenticated `AppShell`, representative pages (`/`, customers, invoices, create customer, currencies). Package: `@radix-ui/react-dialog`, `@radix-ui/react-separator`, `@radix-ui/react-visually-hidden`.

Database changes:

None.

Tests:

`pnpm typecheck` / `lint` / `format:check` / `test` (261, including `ui-design-system`) / `RUN_DB_INTEGRATION=true pnpm test:integration` (52 passed, 4 skipped) / `build` pass. E2E shell assertion updated for Home heading (live auth still env-gated).

Decisions:

Design system is authoritative for frontend presentation. Extensions must be reusable primitives, not page-specific hacks. See [[UI UX Design System]].

Problems:

Remaining UI debt: not every existing screen was hand-redesigned (companies list, users, reporting groups, fixed rates, invoice edit, branding, etc.); remaining pages should adopt shared primitives opportunistically or when next touched by a product task. Integration suite had no new failures attributable to this checkpoint.

Next task:

[[TASK-042 Email Invoice UI]] (still NOT STARTED)

### 2026-08-21 — TASK-041

Work completed:

Invoice email delivery through EmailService → EmailProvider → ResendAdapter (ADR-007). Recipient defaults to customer email (BR-017). Subject/body from default templates + Notifications §14.1 merge fields; company `email_template_reference` noted when set. From uses `EMAIL_FROM` with company display name; Reply-To from company branding/contact. Attaches stored versioned `invoice_files` PDF (generates once if missing; never claims success without attachment). `email_logs` records SENT/FAILED+retryable; email failure does not un-issue. Queueable via inline dispatcher (BullMQ hardening TASK-099). No email modal UI (TASK-042). No customer portal notifications.

Files changed:

Email abstraction + Resend/Memory adapters, invoice email service/repository/queue, `POST/GET /api/invoices/{id}/email`, audit actions, unit + integration tests, `resend` dependency. Updated [[PDF and Email]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 04 Invoicing]], [[06 Development Log]], [[TASK-041 Email Delivery]]. ADR-007 unchanged (already ACCEPTED).

Database changes:

`20260821240000_email_logs` — `email_logs` + `email_delivery_status`. Applied with `pnpm prisma:migrate:deploy`.

Tests:

Unit: templates/BR-017 + send/attach/fail/Staff deny. Integration: send records `email_logs`. `pnpm typecheck` / `lint` / `format:check` / `test` (259) / email integration / `build` pass. Full integration suite: 2 unrelated failures (companies-crud 5s timeout; customers-profile financial summary fixture). E2E-02 deferred pending TASK-042 UI.

Decisions:

None new. ADR-009 / ADR-010 / ADR-011 / US-011 remain OPEN.

Problems:

None for TASK-041. Full email template CRUD remains Settings later; CC/BCC UI is TASK-042.

Next task:

[[TASK-042 Email Invoice UI]]

### 2026-08-21 — TASK-040

Work completed:

Invoice view PDF preview/download against stored `invoice_files` bytes via StorageService. `GET /api/invoices/{id}/pdf/files/{fileId}` streams PDF with inline or attachment disposition. Historical version files selectable. Does not regenerate when a file row exists; missing blob returns 404. Staff cannot download unassigned invoice PDFs (403). No email. No schema changes.

Files changed:

Download service + file-by-id repository, download API route, `InvoicePdfPanel` on `/invoices/[id]`, authorization unit test. Updated [[PDF and Email]], [[Invoices]], [[Screen Inventory]], [[API and Integrations]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 04 Invoicing]], [[06 Development Log]], [[TASK-040 PDF Preview and Download]]. No ADR change.

Database changes:

None.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format` pass. `pnpm test` 256 passed. `pnpm build` pass.

Decisions:

None. Preview uses iframe to same-origin authorized byte stream.

Problems:

None.

Next task:

[[TASK-041 Email Delivery]]

### 2026-08-21 — TASK-039

Work completed:

Server-side branded invoice PDFs via `@react-pdf/renderer` (ADR-013). Financial content from immutable `invoice_versions` snapshots. Branding/logo/terms and customer billing frozen into PDF bytes at first generation. One `invoice_files` row per version with SHA-256 checksum; blob via StorageService (R2/local). Internal notes never rendered. Existing PDF for a version is reused (no regenerate from today’s mutable data). Best-effort generate after issue; `POST/GET /api/invoices/{id}/pdf`. Queueable dispatcher port (inline default; BullMQ worker = TASK-099). No preview UI (TASK-040). No email.

Files changed:

Migration `20260821230000_invoice_files`, PDF domain/render/service/queue/file store, API route, issue wiring, unit + integration tests, `@react-pdf/renderer` dependency. Updated [[PDF and Email]], [[Invoices]], [[Data Model]], [[Database]], [[Testing]], [[API and Integrations]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 04 Invoicing]], [[06 Development Log]], [[TASK-039 PDF Generation]]. ADR-005/006/013 unchanged (already ACCEPTED).

Database changes:

`invoice_files` metadata table. Applied with `pnpm prisma:migrate:deploy`.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format` pass. `pnpm test` 255 passed. Integration PDF pass (`RUN_DB_INTEGRATION=true`). `pnpm build` pass.

Decisions:

Inline PDF job dispatcher for TASK-039; dedicated worker hardening deferred to TASK-099. A4 default; Letter supported. No ADR status change.

Problems:

None.

Next task:

[[TASK-040 PDF Preview and Download]]

### 2026-08-21 — TASK-038

Work completed:

Soft-cancel invoices (Draft/Issued/Overdue → CANCELLED) with mandatory reason. No hard delete. Invoice number, stored totals, and issue versions preserved. Staff cannot cancel (`invoice.cancel`). Cancelled invoices excluded from collectible customer outstanding (BR-019) via Prisma financial-summary source. Cancel UI with reason on invoice detail. Audit `invoices.cancelled`.

Files changed:

Migration `20260821220000_invoice_cancellation`, domain cancellation helpers, cancel service/API/action/UI, lifecycle transitions, Prisma financial summary source, unit + integration tests. Updated [[Invoices]], [[Data Model]], [[Database]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 04 Invoicing]], [[06 Development Log]], [[TASK-038 Invoice Cancellation]]. No ADR change (ADR-009 still OPEN; no cancel-and-reissue).

Database changes:

`invoices.cancellation_reason`, `cancelled_at`, `cancelled_by_user_id`. Applied with `pnpm prisma:migrate:deploy`.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format` + format check. `pnpm test` 253 passed. Integration cancellation pass (`RUN_DB_INTEGRATION=true`). `pnpm build` pass. E2E-12 PDF preservation deferred until TASK-039.

Decisions:

Allowed cancel from Draft, Issued, Overdue only (state table). Partially Paid / Paid not cancellable here. Financial totals not rewritten on cancel. Cancel-and-reissue / credit notes not implemented.

Problems:

None.

Next task:

[[TASK-039 PDF Generation]]

### 2026-08-21 — TASK-037

Work completed:

Added immutable `invoice_versions` snapshots on issue (header + line items + totals, reason, created_by). Version history UI on invoice view. Issued financial PATCH rejected. Non-financial metadata (reference/PO, assigned staff, compliance, notes) editable by Admin/Compliance with audit; Staff denied. Metadata edits do not create new versions. ADR-009 financial revision / cancel-and-reissue not chosen. No discounts (ADR-010 OPEN).

Files changed:

Migration `20260821210000_invoice_versions`, domain snapshot helpers, version store/service, versions API, issue wiring, PATCH routing, history + metadata UI, unit + integration tests. Updated [[Invoices]], [[Data Model]], [[Database]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 04 Invoicing]], [[06 Development Log]], [[TASK-037 Invoice Versions]]. ADR-009 left OPEN (no decision change).

Database changes:

`invoice_versions` table. Applied with `pnpm prisma:migrate:deploy`.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 249 passed. Integration versions + lifecycle pass. `pnpm build` pass.

Decisions:

No new ADR. Versions = immutable issue snapshots only. Explicitly did not implement ADR-009 revision vs cancel-and-reissue.

Problems:

None for in-scope work.

Next task:

[[TASK-038 Invoice Cancellation]]

### 2026-08-21 — TASK-036

Work completed:

Implemented invoice lifecycle issue path: Draft → ISSUED with delayed numbering at issue (TASK-035 allocate). BR-018 overdue evaluation (ISSUED/PARTIALLY_PAID → OVERDUE when due past and outstanding > 0); applied on list/detail load. Status filters on invoice list; Issue button on draft detail. Illegal transitions rejected. Paid/partial transitions not implemented (no payments). Cancel deferred to TASK-038. Issued financial edits blocked while ADR-009 OPEN. US-011 due-on-receipt not enabled — due date remains mandatory. No new migration.

Files changed:

Created `lifecycle.ts`, lifecycle service, `POST /api/invoices/{id}/issue`, issue button UI, unit + integration lifecycle tests. Updated access helpers, list/get for non-draft, status filters, line-item read for issued, [[Invoices]], [[Testing]], [[Unresolved Source Items]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 04 Invoicing]], [[06 Development Log]], [[TASK-036 Invoice Lifecycle]].

Database changes:

None (status + due_date already present).

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 246 passed. Integration issue + overdue pass. `pnpm build` pass.

Decisions:

No new ADR. Cancel owned by TASK-038. US-011 left OPEN with mandatory due date. ADR-009 remains OPEN — no issued financial edit API.

Problems:

None for in-scope work. Cancel and paid/partial remain later tasks.

Next task:

[[TASK-037 Invoice Versions]]

### 2026-08-21 — TASK-035

Work completed:

Implemented company-scoped invoice numbering (BR-003): `companies.invoice_sequence_next` with `SELECT … FOR UPDATE` allocation; format `{prefix}{NNNNNN}` or `{prefix}{YYYY}-{NNNNNN}` when system setting `invoice_number_include_year` is true. Reuses company branding `invoice_prefix` (TASK-010). Drafts keep `invoice_number` null until assign/issue (delayed numbering). Hand-edited numbers rejected on draft create/update. Read-only display on draft view. Collision / unique `(company_id, invoice_number)` enforced. No issue lifecycle (TASK-036). ADR-009 / ADR-010 / ADR-011 remain OPEN.

Files changed:

Created numbering domain helpers, number store/service, migration `20260821200000_invoice_numbering`, unit + concurrency integration tests. Updated system settings (year flag), draft APIs/actions, invoice view copy, [[Invoices]], [[Settings]], [[Data Model]], [[Database]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 04 Invoicing]], [[06 Development Log]], [[TASK-035 Invoice Numbering]].

Database changes:

`companies.invoice_sequence_next` (default 1); `system_settings.invoice_number_include_year` (default false). Unique constraint already from TASK-030. Applied with `pnpm prisma:migrate:deploy`.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 243 passed. Integration concurrency + isolation tests pass (`RUN_DB_INTEGRATION=true`). `pnpm build` pass.

Decisions:

No new ADR. Number assignment at issue remains TASK-036; TASK-035 provides allocate/assign primitives. Cancelled-number reuse remains excluded.

Problems:

None.

Next task:

[[TASK-036 Invoice Lifecycle]]

### 2026-08-21 — TASK-034

Work completed:

Implemented server-side invoice totals (subtotal, discount_total=0 while ADR-010 OPEN, tax_total from line tax snapshots, invoice_total, confirmed_paid_amount, outstanding_amount via BR-009). Stored on `invoices` and recalculated when draft line items are replaced. Display-only totals panel on draft view/edit. No payment workflows; paid/outstanding use empty applications until payments exist. No discount model invented. ADR-009 / ADR-011 remain OPEN.

Files changed:

Created `src/domain/invoices/totals.ts`, totals panel UI, unit totals tests, migration `20260821190000_invoice_totals`. Updated invoice repository/line-item service, draft UI, [[Invoices]], [[Data Model]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 04 Invoicing]], [[06 Development Log]], [[TASK-034 Invoice Totals]].

Database changes:

Migration adds stored total columns on `invoices`. Applied with `pnpm prisma:migrate:deploy`.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 237 passed. Line-items integration asserts persisted totals. `pnpm build` pass.

Decisions:

`discount_total` always 0 while ADR-010 is OPEN. Tax total = sum of round(line_total × tax_rate_percent / 100). Invoice total = subtotal − discount + tax. Confirmed paid is never a manually edited source of truth.

Problems:

None blocking.

Next task:

[[TASK-035 Invoice Numbering]]

### 2026-08-21 — TASK-033

Work completed:

Implemented invoice line items on drafts: `invoice_items` table, nested replace API, server-side `line_total = round(qty × unitRate)` via Prisma Decimal (ADR-004). Optional tax name/rate snapshots stored; discount blocked while ADR-010 OPEN. Line editor on draft edit UI; read-only list on view. Issued invoices cannot mutate lines. Invoice-level totals deferred to TASK-034. ADR-009 / ADR-011 remain OPEN.

Files changed:

Created migration `20260821180000_invoice_line_items`, domain line-total + schema, line-item service/repository methods, `/api/invoices/{id}/items`, line editor UI, unit + integration tests. Updated [[Invoices]], [[Data Model]], [[API and Integrations]], [[Authorization]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 04 Invoicing]], [[06 Development Log]], [[TASK-033 Invoice Line Items]].

Database changes:

Migration adds `invoice_items` (quantity/unit_rate/line_total NUMERIC; optional tax snapshot; no discount columns). Applied with `pnpm prisma:migrate:deploy`.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 233 passed. `RUN_DB_INTEGRATION=true pnpm test:integration -- tests/integration/invoices-line-items.test.ts` pass. `pnpm build` pass.

Decisions:

Line total excludes tax application until TASK-034. ADR-010 remains OPEN — discount fields rejected. Client previews use the same domain formula but saved totals are always server-written.

Problems:

None blocking.

Next task:

[[TASK-034 Invoice Totals]]

### 2026-08-21 — TASK-032

Work completed:

Implemented invoice draft UI: company-scoped list/filter, create draft, view draft, edit draft. Consumes TASK-031 Server Actions. Active customers + company-enabled currencies only. Internal notes labeled never customer-visible / never printed or emailed. Totals placeholder until TASK-034. No PDF/email/payment actions. No migrations. ADR-009 / ADR-011 remain OPEN.

Files changed:

Created `/invoices` pages + draft form/filters, `src/server/invoices/actions.ts`. Extended currency picker `valueMode: "code"`, home/header nav, company-scope list authz test. Updated [[Invoices]], [[Screen Inventory]], [[Authorization]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 04 Invoicing]], [[06 Development Log]], [[TASK-032 Invoice Draft UI]].

Database changes:

None.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 227 passed. `pnpm build` pass. Integration/E2E N/A per task.

Decisions:

Draft list defaults company from header context when set; Admin must select a concrete company when All Companies context is active. Edit button shown only when `canStaffEditDraftInvoice` allows.

Problems:

None blocking.

Next task:

[[TASK-033 Invoice Line Items]]

### 2026-08-21 — TASK-031

Work completed:

Implemented draft invoice create/list/get/update APIs on TASK-030 `invoices` header. Enforced BR-001 (company+customer linked), BR-002 (company-enabled ACTIVE currency), ACTIVE customer gate (TASK-028), company access, and Staff own/assigned draft edit. Assigned staff defaults to creator. Audit `invoices.created` / `invoices.updated`. No schema migration. No line items, totals, numbering, issue/send, or PDF. ADR-009 / ADR-011 remain OPEN.

Files changed:

Created `src/domain/invoices/access.ts`, `src/server/invoices/invoice-draft-service.ts`, `/api/invoices` routes, unit + integration draft tests. Extended draft schema, invoice list store, `validateCurrencyCodeForNewDocument`, audit actions. Updated [[Invoices]], [[API and Integrations]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 04 Invoicing]], [[06 Development Log]], [[TASK-031 Invoice Draft Service]].

Database changes:

None.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 226 passed. `RUN_DB_INTEGRATION=true pnpm test:integration -- tests/integration/invoices-draft.test.ts` pass. `pnpm build` pass.

Decisions:

Draft service exposes drafts only. Staff without `invoice.view_assigned` (US-008 denied) see/edit only own or assigned drafts. Admin/Compliance edit any draft in accessible companies. Currency validated by code against company configuration.

Problems:

None blocking.

Next task:

[[TASK-032 Invoice Draft UI]]

### 2026-08-21 — TASK-030

Work completed:

Implemented invoice header domain schema and persistence (Invoices §8.2). BR-001 company+customer required at Zod/Prisma. Draft status default; compliance placeholder; nullable invoice_number. Internal repository only (no public CRUD, issue, PDF, payments, line items, or totals). ADR-009 / ADR-011 remain OPEN.

Files changed:

Created `src/domain/invoices/{types,schema}.ts`, `src/server/invoices/invoice-repository.ts`, migration `20260821160000_invoice_domain_schema`, unit schema tests. Updated Prisma Invoice model + relations, prerequisite architecture/db/integration assertions, audit entity type, [[Invoices]], [[Data Model]], [[Database]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 04 Invoicing]], [[06 Development Log]], [[TASK-030 Invoice Domain Schema]].

Database changes:

Migration adds `invoice_status`, `invoice_compliance_status` enums and `invoices` table. Applied with `pnpm prisma:migrate:deploy`.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 221 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 43 passed, 4 skipped. `pnpm build` pass. Integration/Authorization/E2E N/A per task for new invoice APIs.

Decisions:

Defer BR-002 company currency enablement enforcement to TASK-031 draft service. Totals deferred to TASK-034. Numbering deferred to TASK-035.

Problems:

None blocking.

Next task:

[[TASK-031 Invoice Draft Service]]

### 2026-08-21 — TASK-029

Work completed:

Implemented currency-aware customer financial summary (Total Invoiced, Total Paid, Outstanding, Overdue) as by-currency buckets only (BR-013). Wired empty invoice source until Phase 04. Profile UI summary panel + `GET /api/customers/{id}/financial-summary`. Placeholder invoices/payments list endpoints. No invented totals. No reporting-currency conversion without stored snapshots. No new migrations. ADR-011 remains OPEN.

Files changed:

Created financial-summary domain, empty source adapter, summary service, financial-summary/invoices/payments API routes, profile summary panel, unit tests. Updated profile types/service, access helper, profile page, [[Customers]], [[API and Integrations]], [[Authorization]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 03 Customers]], [[06 Development Log]], [[TASK-029 Customer Financial Summary]].

Database changes:

None (read aggregates only; invoice tables not present).

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 216 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 43 passed, 4 skipped (profile assertion updated for empty summary). `pnpm build` pass. E2E N/A.

Decisions:

Live amounts stay empty via `EmptyCustomerFinancialSummarySource` until invoice domain exists. Mixed currencies never collapse to one unlabeled total.

Problems:

None blocking.

Next task:

[[TASK-030 Invoice Domain Schema]]

### 2026-08-21 — TASK-028

Work completed:

Implemented non-blocking customer duplicate detection (email, phone, display name) on create/update. Admin/Compliance may acknowledge and proceed; Staff cannot. Soft ACTIVE/INACTIVE status controls clarified; `assertCustomerActiveForNewInvoice` gate ready for invoicing. No merge. No hard delete. No new migration (status already present). ADR-011 remains OPEN.

Files changed:

Created `src/domain/customers/duplicates.ts`, unit/integration duplicate tests. Updated customer schema/service/repository/actions, create/update APIs (409 warning payload), customer form warning UI, status controls copy, [[Customers]], [[API and Integrations]], [[Authorization]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 03 Customers]], [[06 Development Log]], [[TASK-028 Customer Duplicate Detection and Status]].

Database changes:

None.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 212 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 43 passed, 4 skipped. `pnpm build` pass. E2E N/A.

Decisions:

Reuse existing `customers.status` as the deactivated flag. Invoice blocking is exposed as a domain gate; invoice create will enforce it when invoicing ships.

Problems:

None blocking.

Next task:

[[TASK-029 Customer Financial Summary]]

### 2026-08-21 — TASK-027

Work completed:

Implemented internal-only customer notes (`customer_notes`) with author and timestamp. Create/list APIs and profile UI. Access reuses customer company-link scoping. Audits `customers.note_created`. PDF/email payload fixture omits notes. No portal notes. No edit/delete. ADR-011 remains OPEN.

Files changed:

Created migration `20260821140000_customer_notes`, note domain/schema/repository/service, notes API, profile notes panel, external-document payload fixture, unit/integration tests. Updated profile types/service, actions, audit types, [[Customers]], [[Data Model]], [[Database]], [[Authorization]], [[API and Integrations]], [[Audit Logs]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 03 Customers]], [[06 Development Log]], [[TASK-027 Customer Notes]].

Database changes:

Migration adds `customer_note_visibility` enum and `customer_notes` table. Applied with `pnpm prisma:migrate:deploy`.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 204 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 42 passed, 4 skipped. `pnpm build` pass. E2E N/A.

Decisions:

Visibility is fixed INTERNAL. Create/list only. Body content is not stored in audit (length only).

Problems:

None.

Next task:

[[TASK-028 Customer Duplicate Detection and Status]]

### 2026-08-21 — TASK-026

Work completed:

Implemented the customer profile operational view. Profile summary endpoint returns identity, authorized linked companies, placeholders for financial/invoices/payments/notes (no invented mixed totals — BR-013), and scoped customer audit activity. UI at `/customers/[id]` with company filter. Unassigned company data omitted for Staff/Compliance. No schema migration. ADR-011 remains OPEN.

Files changed:

Created profile domain types, profile service, `GET /api/customers/{id}/profile`, profile company filter UI, unit/integration profile tests. Updated customer detail page, actions, audit repository `listByEntity`, [[Customers]], [[API and Integrations]], [[Authorization]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 03 Customers]], [[06 Development Log]], [[TASK-026 Customer Profile]].

Database changes:

None (read model only).

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 201 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 41 passed, 4 skipped. `pnpm build` pass. E2E N/A.

Decisions:

Financial summary widgets stay placeholders until TASK-029. Threaded notes stay placeholder until TASK-027. Activity uses entity-scoped audit reads under `customer.edit` (not full `audit.read` viewer).

Problems:

None.

Next task:

[[TASK-027 Customer Notes]]

### 2026-08-21 — TASK-025

Work completed:

Implemented `customer_companies` multi-company linkage. Replaced TASK-023 interim access (`defaultCompanyId` / assignee) with linked-company ∩ `user_companies` for Staff/Compliance. Admin may link across companies. Link/unlink/set APIs; create/edit UI multi-select; list `companyId` filter. Backfilled existing `default_company_id` into links. Audits `customers.companies_updated`. ADR-011 remains OPEN.

Files changed:

Created migration `20260821120000_customer_companies`, companies API route. Updated Prisma Customer/Company relations, customer access/schema/repository/service, list/create/edit UI, audit types, unit/integration tests. Updated [[Customers]], [[Data Model]], [[Database]], [[Authorization]], [[Security]], [[API and Integrations]], [[Audit Logs]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 03 Customers]], [[06 Development Log]], [[TASK-025 Customer Company Relationships]].

Database changes:

Migration adds `customer_companies` and backfills from `customers.default_company_id`. Applied with `pnpm prisma:migrate:deploy`.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 198 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 40 passed, 4 skipped. `pnpm build` pass. E2E N/A.

Decisions:

Access supersedes interim TASK-023 scoping. `defaultCompanyId` remains preference and must be among linked companies when set. Staff/Compliance merge preserves links outside their assignment.

Problems:

None.

Next task:

[[TASK-026 Customer Profile]]

### 2026-08-21 — TASK-024

Work completed:

Implemented customer list/search/filter, create, edit, and master-summary screens. Server Actions wrap TASK-023 customer service (revalidate; no duplicated business logic). Soft-deactivate controls for Admin on detail. No financial totals (BR-013). No profile (TASK-026). No `customer_companies` (TASK-025). ADR-011 remains OPEN.

Files changed:

Created customer Server Actions, list-query helper, `/customers` pages (list/new/detail/edit), form + filters + status controls, unit list-query test. Updated home nav, [[Customers]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 03 Customers]], [[06 Development Log]], [[TASK-024 Customer List and Form UI]].

Database changes:

None.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 196 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 40 passed, 4 skipped. `pnpm build` pass (after clearing stale `.next`). E2E N/A. Staff scope enforced by TASK-023 service used by UI.

Decisions:

Detail page is master summary only — not the §7.2 profile. Default company picker uses switcher-accessible companies; Staff/Compliance must pick an assigned company on create.

Problems:

None.

Next task:

[[TASK-025 Customer Company Relationships]]

### 2026-08-21 — TASK-023

Work completed:

Implemented customer create/read/update/search APIs with role matrix and company-scoped access. Soft-deactivate via `customer.delete` (Admin); hard delete never. Staff/Compliance must supply an accessible `defaultCompanyId`; Staff limited/assigned via company assignment or `assignedStaffUserId`. Audits `customers.created` / `updated` / `status_changed`. No UI. No `customer_companies` (TASK-025). ADR-011 remains OPEN.

Files changed:

Created customer access helper, service, `/api/customers` routes (+ status), unit/integration tests. Updated repository list/search, audit types, [[Customers]], [[Authorization]], [[Security]], [[API and Integrations]], [[Audit Logs]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 03 Customers]], [[06 Development Log]], [[TASK-023 Customer CRUD Service]].

Database changes:

None.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 194 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 40 passed, 4 skipped. `pnpm build` pass. E2E N/A.

Decisions:

Until TASK-025, company scope uses `defaultCompanyId` and assignee matching (not invented `customer_companies`). Deactivation is not allowed through PATCH edit.

Problems:

None.

Next task:

[[TASK-024 Customer List and Form UI]]

### 2026-08-21 — TASK-022

Work completed:

Implemented the customer master schema from Customers §7.1 on `customers`. Email is optional. Soft ACTIVE/INACTIVE status only (no hard-delete repository method). Domain Zod constraints and internal `PrismaCustomerStore` only — no public CRUD API, UI, or authorization service. Optional `default_company_id` is a preference, not ownership; `customer_companies` remains TASK-025. ADR-011 remains OPEN.

Files changed:

Created customer domain types/schema, internal repository, migration `20260821000000_customer_domain_schema`, unit schema tests. Updated Prisma User/Company relations, prerequisite foundation/authz tests, [[Customers]], [[Data Model]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 03 Customers]], [[06 Development Log]], [[TASK-022 Customer Domain Schema]].

Database changes:

Migration adds `customer_type` / `customer_status` enums and `customers` table. Applied with `pnpm prisma:migrate:deploy`.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 189 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 39 passed, 4 skipped. `pnpm build` pass. Integration/E2E N/A per task.

Decisions:

No new ADR. Payment preference stored as free text (no invented enum). Customer master is not single-company-owned.

Problems:

None.

Next task:

[[TASK-023 Customer CRUD Service]]

### 2026-08-21 — TASK-021

Work completed:

Implemented currency disable vs historical visibility rules on existing catalog status flags. Domain `assertCurrencySelectableForNewDocument` / `currenciesForNewDocumentPicker` / `currencyLabelForHistoricalDisplay` separate new-selection (reject INACTIVE) from historical display (keep codes/labels). Server hooks `validateCurrencyForNewDocument`, `listCurrenciesForNewDocument`, and `resolveCurrencyForHistoricalDisplay` are ready for later invoice/payment callers (callers own authz). `NewDocumentCurrencyPicker` hides disabled currencies. Company currency save preserves historically enabled INACTIVE assignments. No new schema. ADR-011 remains OPEN.

Files changed:

Created selection domain, currency-selection service, new-document picker, unit tests. Updated company currency repository/service/form, settlement historical copy, Prisma comments, [[Currency and Conversion]], [[Error Handling]], [[Authorization]], [[Security]], [[API and Integrations]], [[Database]], [[Settings]], [[Testing]], ADR-011 note, [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 02 Financial Foundation]], [[06 Development Log]], [[TASK-021 Currency Disable and Historical Visibility]].

Database changes:

None (status flags only; TASK-014 `currencies.status`).

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 181 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 39 passed, 4 skipped. `pnpm build` pass. Integration/E2E N/A per task.

Decisions:

No new ADR. Selection hooks follow TASK-018 pattern (no Admin gate). ADR-011 remains OPEN.

Problems:

None.

Next task:

[[TASK-022 Customer Domain Schema]]

### 2026-08-20 — TASK-020

Work completed:

Implemented per-company, per-payment-method settlement currency enablement on the gateway config shape (`payment_gateway_configs` + `payment_gateway_settlement_currencies`). Method codes are provider-agnostic (STRIPE, PAYPAL, BANK_PROCESSOR, MANUAL). Initial Version 1 settlement currencies are USD and AED; Admin may enable other globally ACTIVE catalog codes (BR-006 / BR-007). Non-enabled settlement currencies are rejected via `assertSettlementCurrencyEnabled`. Encrypted credentials, sandbox/live, webhooks, and live charges were not implemented (TASK-049+). ADR-011 remains OPEN.

Files changed:

Created settlement domain/schemas, repository/service/actions, `/api/companies/{id}/settlement` (+ method PATCH), company Settlement UI, unit/integration tests, migration `20260820320000_settlement_currency_configuration`. Updated Prisma schema, audit action/entity, company detail link, [[Currency and Conversion]], [[Payments]], [[Companies and Brands]], [[Data Model]], [[Security]], [[Authorization]], [[API and Integrations]], [[Database]], [[Settings]], [[Audit Logs]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 02 Financial Foundation]], [[06 Development Log]], [[TASK-020 Settlement Currency Configuration]].

Database changes:

Migration adds `payment_method_code` enum, `payment_gateway_configs` (company, method, enabled; no credentials), and `payment_gateway_settlement_currencies` (gateway_config_id, currency_code, enabled). Applied with `pnpm prisma:migrate:deploy`.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 170 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 42 passed, 1 skipped (recovery-link). `pnpm build` pass. E2E N/A.

Decisions:

Admin-only under existing `gateway.credentials.manage` (same permission TASK-049 will extend for credentials). No provider-specific branches in domain code (ADR-008).

Problems:

None.

Next task:

[[TASK-021 Currency Disable and Historical Visibility]]

### 2026-08-20 — TASK-019

Work completed:

Implemented the centralized financial calculation domain (`src/domain/money`) using Prisma Decimal. Includes `computeConvertedSettlementAmount` (invoice × fixed rate; merchant fee excluded), same-currency rate 1, half-up rounding to currency precision, system-settings rounding tolerance comparison, invoice outstanding from confirmed applications (BR-009), and mixed-currency unlabeled-total guard (BR-013). Display formatting is explicitly non-authoritative. No invoice/payment/settlement workflows. ADR-011 remains OPEN.

Files changed:

Created money domain modules and unit tests. Updated [[Currency and Conversion]], [[Data Model]], [[Engineering Rules]], [[Testing]], [[Settings]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 02 Financial Foundation]], [[06 Development Log]], ADR-004 consequences, [[TASK-019 Money Calculation Utilities]].

Database changes:

None.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 164 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 40 passed, 1 skipped (recovery-link). `pnpm build` pass. Integration/E2E N/A per task.

Decisions:

No new ADR. Rounding mode is half-up to currency `decimalPrecision`. `system_settings.roundingTolerance` is used for within-tolerance zero comparisons, not as the money scale. ADR-011 remains OPEN.

Problems:

None blocking. Settlement currency configuration remains TASK-020.

Next task:

[[TASK-020 Settlement Currency Configuration]] (not started)

### 2026-08-20 — TASK-018

Work completed:

Implemented effective fixed-rate selection for a currency pair at a timestamp. Domain `selectEffectiveRate` / server `resolveFixedConversionRate` read `valid_from`/`valid_to` windows (EXPIRED versions remain selectable historically). Same-currency resolves to Decimal string `1.000000000000`. Missing Admin rate returns a clear configuration error and never substitutes market/gateway FX. No payment conversion, settlement, invoice conversion, or UI. ADR-011 remains OPEN.

Files changed:

Created `resolve-rate` domain + server service and unit tests. Updated fixed-rate types/repository comments, Prisma comments, currency form type export for typecheck, [[Currency and Conversion]], [[Error Handling]], [[Database]], [[API and Integrations]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 02 Financial Foundation]], [[06 Development Log]], ADR-011 note, [[TASK-018 Effective Rate Selection]].

Database changes:

None. Read model over existing `fixed_conversion_rates`.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 154 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 40 passed, 1 skipped (recovery-link). `pnpm build` pass. Integration/E2E N/A per task.

Decisions:

No new ADR. Window is `validFrom <= at < validTo` (open-ended when `validTo` is null). Status is not the sole selector. Authorization is N/A for this pure resolve service; later conversion callers enforce their own authz. ADR-011 remains OPEN.

Problems:

None blocking. Money calculation utilities remain TASK-019.

Next task:

[[TASK-019 Money Calculation Utilities]] (not started)

### 2026-08-20 — TASK-017

Work completed:

Implemented append-only fixed conversion rate versioning. Creating a new version for a currency pair expires/closes prior ACTIVE versions (sets `EXPIRED` and closes `valid_to`) while retaining rows and original `fixed_rate` values permanently. Added version history list UI/API and lifecycle audits (created/scheduled/activated/expired/superseded). No in-place PATCH of historical rate amounts. Effective rate selection, payment conversion, and settlement were not implemented. ADR-011 remains OPEN.

Files changed:

Updated fixed-rate repository/service/actions, `GET/POST /api/fixed-conversion-rates`, Settings version history page, create UI copy, home link, unit/integration tests. Updated [[Security]], [[Authorization]], [[API and Integrations]], [[Database]], [[Currency and Conversion]], [[Settings]], [[Audit Logs]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 02 Financial Foundation]], ADR-011 note, [[TASK-017 Fixed Rate Versioning]].

Database changes:

No new migration. Reuses TASK-016 `fixed_conversion_rates` columns (`status`, `valid_to`) for expire/close on create.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 148 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 40 passed, 1 skipped (recovery-link). `pnpm build` pass. E2E N/A (E2E-13 precursor).

Decisions:

No new ADR. Expire-previous runs on create (not a separate activation job). Scheduled vs activated audit is based on `validFrom` vs now. ADR-011 remains OPEN.

Problems:

None blocking. Effective rate selection remains TASK-018.

Next task:

[[TASK-018 Effective Rate Selection]] (not started)

### 2026-08-20 — TASK-016

Work completed:

Implemented Admin-defined fixed conversion rate storage on `fixed_conversion_rates` with `NUMERIC(20, 12)` precision. Create-only API and Settings UI under `currency.manage`. No live FX, market, or gateway rate substitution. In-place historical edit is not offered. Expire-previous-on-create and version history list remain TASK-017. Effective selection, settlement, and payment conversion were not implemented. ADR-011 remains OPEN.

Files changed:

Created fixed-rates domain/schemas, repository/service/actions, `POST /api/fixed-conversion-rates`, Settings create UI, unit/integration tests, migration `20260820310000_fixed_conversion_rate_schema`. Updated Prisma schema, audit action, home link, prerequisite integration table assertions, [[Security]], [[Authorization]], [[API and Integrations]], [[Database]], [[Currency and Conversion]], [[Settings]], [[Audit Logs]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 02 Financial Foundation]], ADR-004/ADR-011 notes, [[TASK-016 Fixed Conversion Rate Schema]].

Database changes:

Migration adds `fixed_conversion_rates` and frequency/status enums. Applied with `pnpm prisma:migrate:deploy`. No payment snapshot tables or live FX integrations.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 146 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 40 passed, 1 skipped (recovery-link). `pnpm build` pass. E2E N/A.

Decisions:

No new ADR. Uses existing `currency.manage` (Admin). Rates are Decimal strings on the wire; storage is `NUMERIC(20, 12)` per ADR-004 / Database conventions. ADR-011 remains OPEN.

Problems:

None blocking. Fixed rate versioning (expire previous) remains TASK-017.

Next task:

[[TASK-017 Fixed Rate Versioning]] (not started)

### 2026-08-20 — TASK-015

Work completed:

Implemented per-company enabled invoice currency subset and default invoice currency on `company_currencies`. Admin manages under `company.write` (company subresource, same as branding). Globally INACTIVE currencies cannot be newly enabled (BR-002). Settlement currencies, fixed conversion rates, and invoice draft currency selection were not implemented. ADR-011 remains OPEN.

Files changed:

Created company-currency domain/schemas, repository/service/actions, `/api/companies/{id}/currencies`, company Currencies UI, unit/integration tests, migration `20260820300000_company_currency_configuration`. Updated Prisma schema, audit action, company detail link, prerequisite integration table assertions, [[Security]], [[Authorization]], [[API and Integrations]], [[Database]], [[Currency and Conversion]], [[Companies and Brands]], [[Settings]], [[Audit Logs]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 02 Financial Foundation]], ADR-011 note, [[TASK-015 Company Currency Configuration]].

Database changes:

Migration adds `company_currencies` (`company_id`, `currency_id`, `enabled`, `is_default`) with FKs to companies (CASCADE) and currencies (RESTRICT). Applied with `pnpm prisma:migrate:deploy`. No fixed-rate or settlement tables.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 143 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 38 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A (E2E-09 remains later invoice flow).

Decisions:

No new ADR. ADR-011 remains OPEN. Company currency management uses existing `company.write` (Admin), not `currency.manage` (global catalog).

Problems:

None blocking. Fixed conversion rate schema remains TASK-016.

Next task:

[[TASK-016 Fixed Conversion Rate Schema]] (not started)

### 2026-08-20 — TASK-014

Work completed:

Implemented the global currency catalog with seeded defaults USD, AED, PKR, GBP, AUD. Admin may add currencies and disable (soft status) under `currency.manage`. Disabled currencies remain retained for later historical display (BR-011). Company currency enablement, fixed conversion rates, settlement configuration, and live FX were not implemented. ADR-011 remains OPEN.

Files changed:

Created currencies domain/schemas, repository/service/actions, `/api/currencies` routes, Settings Currencies UI, unit/integration tests, migration `20260820290000_currency_master`. Updated Prisma schema, home Admin link, audit actions, prerequisite system-settings table assertion, [[Security]], [[Authorization]], [[API and Integrations]], [[Database]], [[Settings]], [[Currency and Conversion]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 02 Financial Foundation]], ADR-011 note, [[TASK-014 Currency Master]].

Database changes:

Migration adds `currencies` and seeds five ACTIVE defaults. Applied with `pnpm prisma:migrate:deploy`. No `company_currencies` or fixed-rate tables.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 139 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 36 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A (E2E-09 precursor only).

Decisions:

No new ADR. ADR-011 remains OPEN. Reporting currency on `system_settings` stays a free configurable code (not FK-locked to the catalog here).

Problems:

None blocking. Company currency configuration remains TASK-015.

Next task:

[[TASK-015 Company Currency Configuration]] (not started)

### 2026-08-20 — TASK-013

Work completed:

Implemented core system settings persistence and Admin UI. Stores configurable reporting currency code (ADR-011 remains OPEN; USD seed is a recommendation), default IANA timezone, and a rounding-tolerance placeholder (Decimal). Added Admin-only `settings.manage` permission. Setting updates write audit events (BR-015). Fixed conversion rates and gateway credentials were not implemented. Secrets are not stored in `system_settings`.

Files changed:

Created settings domain/schemas, repository/service/actions, `/api/system-settings`, `/settings/system` UI, unit/integration tests, migration `20260820280000_core_system_settings`. Updated permissions/matrix, home link, audit actions, [[Security]], [[Authorization]], [[API and Integrations]], [[Database]], [[Settings]], [[Roles and Permissions]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-011 consequences note, [[TASK-013 Core System Settings]].

Database changes:

Migration adds `system_settings` singleton seed and `settings.manage` (Admin). Applied with `pnpm prisma:migrate:deploy`. No currency master, fixed rates, or gateway tables.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 135 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 34 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A.

Decisions:

No new ADR. ADR-011 remains OPEN. Reporting currency is a free 3-letter code until TASK-014. Authorization uses `settings.manage` (Admin only), not role-code checks.

Problems:

None blocking. Currency master remains TASK-014.

Next task:

[[TASK-014 Currency Master]] (not started)

### 2026-08-20 — TASK-012

Work completed:

Implemented append-only `audit_logs` foundation and wired writers for login success/failure/logout, user create/update/suspend (role/company/status), and company create/update/status. Sensitive values are masked before persistence. UTC timestamps and correlation IDs are stored. Pino remains operational logging (ADR-014). No audit viewer UI/API. Actor/company IDs are historical references without FKs.

Files changed:

Created audit domain (types/mask/schema), append-only repository/service, unit/integration tests, migrations `20260820270000_audit_event_foundation` and `20260820270100_audit_event_no_fk`. Wired login/logout, user-service, company-service. Updated [[Security]], [[API and Integrations]], [[Database]], [[Audit Logs]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-014 consequences, [[TASK-012 Audit Event Foundation]].

Database changes:

Migrations add `audit_logs` and drop actor/company FKs. Applied with `pnpm prisma:migrate:deploy`. No viewer tables, currencies, invoices, or payments.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 131 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 32 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A.

Decisions:

No new ADR. ADR-014 consequences updated to separate Pino from `audit_logs`. Auth audit writes are best-effort so login availability does not depend on audit persistence; privileged Admin mutations require a successful audit write (BR-015). US-010 remains OPEN.

Problems:

None blocking. Audit viewer remains TASK-076. Later mandatory event categories (currency, invoice, payment, gateway, etc.) remain later tasks.

Next task:

[[TASK-013 Core System Settings]] (not started)

### 2026-08-20 — TASK-011

Work completed:

Implemented optional parent reporting groups for consolidated report roll-ups. Admin may create/edit/activate/deactivate groups and assign companies. VX is documented as an example only; no seed data was added. Group membership does not grant company access; `user_companies` / `assertCompanyAccess` remain authoritative. Company context validation is unchanged. Monthly brand matrix and reporting engines were not implemented.

Files changed:

Created reporting-group domain/schemas, repository/service/actions, `/api/reporting-groups` routes, Settings Reporting Groups UI, unit/integration tests, migration `20260820260000_reporting_groups`. Updated Prisma schema, home Admin link, prerequisite tests, [[Authorization]], [[Security]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-003 consequences, [[TASK-011 Reporting Groups]].

Database changes:

Migration `20260820260000_reporting_groups` adds `company_groups` and `companies.reporting_group_id`. Applied with `pnpm prisma:migrate:deploy`. No currencies, invoices, payments, audit tables, or report engines.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 125 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 29 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A.

Decisions:

No new ADR. Reporting groups are organizational/reporting constructs only. Historical transaction ownership remains the original company/brand (enforced by not changing ownership models here).

Problems:

None blocking. Audit event foundation remains TASK-012.

Next task:

[[TASK-012 Audit Event Foundation]] (not started)

### 2026-08-20 — TASK-010

Work completed:

Implemented Admin company branding configuration as a company subresource. Stores company-specific invoice prefix, terms and conditions, email template reference, brand contact details, and logo file metadata. Logo uploads are validated by MIME, magic bytes, and 2 MB size limit, then persisted through StorageService (Cloudflare R2 when configured; local `.data/object-storage` in local/test). Staff cannot change branding. PDF rendering, email sending, and invoice sequence issuance were not implemented.

Files changed:

Created branding domain/schemas/logo validation, branding repository/service/actions, StorageService adapters, `/api/companies/[id]/branding` and logo routes, Invoice Branding UI, unit/integration branding tests, migration `20260820250000_company_branding`. Updated Prisma Company model, company screens, prerequisite CRUD tests, `.env.example`, `.gitignore`, [[Security]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-006 consequences, [[TASK-010 Company Branding Configuration]].

Database changes:

Migration `20260820250000_company_branding` adds branding and logo metadata columns on `companies`. Applied with `pnpm prisma:migrate:deploy`. No invoice sequence, currencies, reporting groups, or gateway credentials. Logo binaries are not stored in PostgreSQL.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 120 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 27 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A.

Decisions:

No new ADR. ADR-006 StorageService introduced for logo objects ahead of PDF storage. Branding remains Admin/`company.write` only. Invoice numbering sequence remains TASK-035.

Problems:

None blocking. Reporting groups remain TASK-011.

Next task:

[[TASK-011 Reporting Groups]] (not started)

### 2026-08-20 — TASK-009

Work completed:

Implemented tenant isolation company context and the authenticated-layout header company switcher. Admin may select All Companies for consolidated reporting only. Transactional company-scoped actions require one concrete company and matching `company_id` (IDOR denied). Context is stored in httpOnly cookie `app-company-context` and revalidated against Admin ALL / assigned access on every resolve. Context change revalidates the app layout. Currencies, invoices, payments, branding, and reporting groups were not implemented. US-007–010 remain OPEN with default deny. `password_reset_required` remains workflow-only.

Files changed:

Created `src/domain/company-context/*`, `src/server/company-context/*`, header switcher UI, `/api/company-context` and transactional probe routes, unit/integration company-context tests. Updated authenticated layout/home, company store `listCompaniesByIds`, [[Authorization]], [[Security]], [[API and Integrations]], [[Error Handling]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-003 consequences, [[TASK-009 Tenant Isolation and Company Context]].

Database changes:

None. No new tables. Company context is cookie-based preference state, not a financial record.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 115 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 25 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A.

Decisions:

No new ADR. Admin All Companies remains reporting-only. Reporting groups are not authorization and were not introduced. Later transactional modules must reuse `assertTransactionalCompanyScope`.

Problems:

None blocking. Company branding remains TASK-010.

Next task:

[[TASK-010 Company Branding Configuration]] (not started)

### 2026-08-20 — TASK-008

Work completed:

Implemented user-company assignments. Admin may access all companies without assignment rows. Compliance and Staff are constrained to `user_companies` IDs via `assertCompanyAccess`. Admin user create/edit persists assigned company IDs. Unassigned company GET is denied with 403. Company switcher, reporting-group authorization, invoices, and payments were not implemented. US-007–010 remain OPEN with default deny. `password_reset_required` remains workflow-only.

Files changed:

Created `src/domain/authz/company-access.ts`, assignment UI fields, migration `20260820240000_user_company_assignments`, unit/integration assignment tests. Updated Prisma `UserCompany`, principal loading, user create/update, company GET access, user forms, [[Authorization]], [[Security]], [[API and Integrations]], [[Database]], [[Authentication]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-003 consequences, [[TASK-008 User Company Assignments]].

Database changes:

Migration `20260820240000_user_company_assignments` adds `user_companies (user_id, company_id)`. Applied with `pnpm prisma:migrate:deploy`. No reporting groups, switcher state, currencies, invoices, or payments.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 103 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 22 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A (E2E-07 precursor covered in integration).

Decisions:

No new ADR. Assignments live only in the application database. Admin ALL is independent of stored assignment rows. Reporting groups are not used as authorization.

Problems:

None blocking. Header company switcher and per-request company context remain TASK-009.

Next task:

[[TASK-009 Tenant Isolation and Company Context]] (not started)

### 2026-08-20 — TASK-007

Work completed:

Implemented Admin company CRUD: create, list, view, edit, activate, and deactivate. Company records store identity, structured address, ISO country, contact details, optional registration/tax number, and Active/Inactive status. Invalid updates are rejected. There is no hard-delete. Gateway credentials, currencies, invoice numbering, logo/branding files, reporting groups, user-company assignments, and tenant isolation were not implemented.

Files changed:

Created `src/domain/companies/*`, `src/server/companies/*`, `/companies` UI, `/api/companies` routes, migration `20260820230000_company_crud`, unit/integration company-crud tests. Updated Prisma schema, home Admin link, prerequisite tests, [[Authorization]], [[Security]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-003 consequences, [[TASK-007 Company CRUD]].

Database changes:

Migration `20260820230000_company_crud` adds `companies` with identity/address/status/names. Applied with `pnpm prisma:migrate:deploy`. No `user_companies`, currencies, invoice prefix/sequence, logo, reporting group, or gateway credential columns/tables.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 97 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 20 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A.

Decisions:

No new ADR. All company HTTP/Server Action operations require `company.write` (Admin), including GET, so unassigned companies are not listed before TASK-008/009. ADR-011 reporting-currency default remains OPEN and was not stored on companies.

Problems:

None blocking. Company assignment remains the next task.

Next task:

[[TASK-008 User Company Assignments]] (not started)

### 2026-08-20 — TASK-006 bootstrap Admin CLI

Work completed:

Added operational `pnpm bootstrap:admin -- --email <user@example.com>` to solve the first-Admin chicken-and-egg without manual SQL. The command assigns the system ADMIN role in the application database only for an existing ACTIVE user already linked to Supabase Auth. It is idempotent for existing Admins, refuses non-Admin role replacement, does not create Auth users, does not accept passwords, and does not write Auth metadata. It is not a runtime authorization bypass; later role changes remain under User Management.

Files changed:

Created `src/domain/ops/bootstrap-admin.ts`, `src/ops/bootstrap-admin-store.ts`, `scripts/bootstrap-admin.ts`, unit/integration bootstrap tests. Updated `package.json` script, tsconfig include, [[Authentication]], [[Authorization]], [[Security]], [[Database]], [[TASK-006 User Management]], [[06 Development Log]].

Database changes:

None (uses existing `users.role_id` and seeded `roles`).

Tests:

Unit bootstrap safety/idempotency coverage. DB integration assigns once, re-runs idempotently, and refuses Staff replacement. Full suite re-verified with typecheck/lint/format/test/integration/build as applicable.

Decisions:

No new ADR. Kept bootstrap outside HTTP/Server Action surfaces so it cannot become an application backdoor.

Problems:

None blocking. Production use of the CLI still requires restricted access to `DATABASE_URL` / operator credentials.

Next task:

[[TASK-007 Company CRUD]] (not started)

### 2026-08-20 — TASK-006

Work completed:

Implemented Admin user management: create/edit/suspend/require password reset. Account fields include name, email, role, employee ID, optional MFA status, status, last login, and `password_reset_required` as a workflow/session flag only (never a role or permission). Supabase Auth Admin API provisions Auth users; application DB owns authorization fields. Suspended users cannot log in or remain in the app shell. Company assignment, MFA challenge productization, and the `audit_logs` store were not implemented.

Files changed:

Created `src/domain/users/*`, `src/server/users/*`, Supabase admin client, active-user gate, `/users` UI, `/api/users` routes, migration `20260820220000_user_management`, unit/integration user-management tests. Updated Prisma users fields, env service-role requirement, login/suspend behavior, home Admin link, [[Authentication]], [[Authorization]], [[Security]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], [[TASK-006 User Management]].

Database changes:

Migration `20260820220000_user_management` adds `users.employee_id`, `users.mfa_enabled`, `users.created_by_user_id`. Applied with `pnpm prisma:migrate:deploy`. No company, credential, or audit_logs tables.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 82 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 16 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A.

Decisions:

No new ADR. Optional Staff policies remain OPEN and default-deny. `password_reset_required` stays workflow/session state only. Live Auth provisioning uses service role only inside the Admin adapter; integration CRUD mocks that boundary.

Problems:

None blocking. Bootstrap Admin may still need a manual `role_id` assign before first UI manage session. Company assignment remains TASK-008.

Next task:

[[TASK-007 Company CRUD]] (not started)

### 2026-08-20 — TASK-005

Work completed:

Implemented Admin, Compliance, and Staff RBAC in the application database and domain layer. Permission checks use `assertPermission`; unauthenticated requests get 401 and other denials get 403. Optional Staff policies US-007–010 are recorded and denied. Customer/invoice/financial hard-delete helpers always return false. `GET /api/roles` is the representative Admin-only action. Login still does not assign a role. Roles are never read from Supabase Auth metadata.

Files changed:

Created `src/domain/authz/*`, `src/server/authz/*`, `GET /api/roles`, migration `20260820210000_roles_and_permissions`, [[Authorization]], unit/integration RBAC tests. Updated Prisma `users.role_id`, identity/architecture tests, [[Authentication]], [[Security]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-003 consequences, [[Unresolved Source Items]].

Database changes:

`roles`, `permissions`, `role_permissions` seeded from the Roles and Permissions matrix. Optional `users.role_id`. Applied with `pnpm prisma:migrate:deploy`. No companies, user_companies, customers, invoices, or payments.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 76 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 13 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A.

Decisions:

No new ADR. Optional Staff grants were not invented. Issued-invoice *capability* `invoice.edit_issued` is granted to Admin/Compliance; the financial edit workflow remains ADR-009 OPEN.

Problems:

None blocking. Company assignment remains TASK-008/009.

Next task:

[[TASK-006 User Management]] (not started)

### 2026-08-20 — TASK-004

Work completed:

Implemented Supabase Auth password recovery and reset on Next.js App Router. Forgot Password and Reset Password screens use React Hook Form + Zod + shadcn/ui. Recovery emails are sent by Supabase Auth, not Resend. The callback exchanges PKCE/OTP server-side, rejects expired/invalid/malformed links, and never logs tokens. Password update uses `updateUser`; sessions are signed out globally afterward. `users.password_reset_required` is an application workflow flag only. Recovery redirects use trusted `APP_URL` paths. Rate limiting reuses the in-memory `AuthRateLimiter` boundary.

Files changed:

Created recovery/reset domain and server modules, forgot/reset screens, `/auth/callback`, `/api/auth/forgot-password`, `/api/auth/reset-password`, migration `20260820200000_password_reset_required`, unit/integration tests. Updated env (`APP_URL`), rate limiter, identity mapping, proxy public paths, login UI, logger redaction, [[Authentication]], [[Security]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], [[TASK-004 Password Reset and Session Controls]].

Database changes:

Migration `20260820200000_password_reset_required` adds `users.password_reset_required`. Applied with `pnpm prisma:migrate:deploy`. No password, password_hash, reset_token, role, permission, or company columns.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 66 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 10 passed, 1 skipped (generated recovery-link; no service role). `pnpm build` pass. Playwright E2E NOT RUN (TASK-004 E2E is N/A).

Live verification:

- Generic recovery response for known and unknown emails: PASS (no account enumeration)
- Authenticated password update, session cleared, original password restored: PASS
- Identity mapping still has no role/company authorization metadata: PASS
- Recovery email click / mailbox callback: SKIPPED. The dedicated test account hit Supabase `over_email_send_rate_limit`. No test mailbox or `SUPABASE_SERVICE_ROLE_KEY` / `RUN_RECOVERY_INTEGRATION` was available. Not marked passed.

Decisions:

No new ADR. Recovery email remains a Supabase Auth identity flow; EmailService/Resend is not used. Provider errors after a valid recovery request still return the generic success message. In-memory rate limiting is process-local, same Redis replacement path as login.

Problems:

Supabase email send rate limit on the shared test account prevented a live recovery-link click-through. Documented as SKIPPED rather than passed.

Next task:

[[TASK-005 Roles and Permissions Model]] (not started)

### 2026-08-20 — TASK-003 live verification

Work completed:

Live Supabase authentication verified against the configured project using the dedicated test account only. Valid login succeeded. Invalid password failed with the generic message. `getUser()` recognized the authenticated session. Logout cleared the Auth session. Application `users` identity mapping was created/updated by `supabase_auth_user_id` with no role, permission, or company columns. Authentication does not grant application authorization. No public signup. Logs recorded only safe events (`auth.login_failed` / `auth.login_succeeded` with application `userId`); no passwords or tokens.

Files changed:

Expanded the gated live Auth integration test. Clarified in [[Authentication]], [[Security]], and `LoginRateLimiter` comments that the current limiter is process-local in-memory and is not production distributed rate limiting (Redis later). Updated this log and [[TASK-003 Authentication Base]].

Database changes:

None. Existing identity mapping row updated on successful live login (`last_login_at`). No authorization fields added.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 41 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 6 passed (including live Auth). `pnpm build` pass. Playwright E2E still NOT RUN (browsers not installed; TASK-003 E2E is N/A).

Decisions:

Did not replace `MemoryLoginRateLimiter`. Documented that it is not globally effective across multiple containers.

Problems:

None.

Next task:

[[TASK-004 Password Reset and Session Controls]] (not started)

### 2026-08-20 — TASK-003

Work completed:

Implemented Supabase Auth login/logout identity foundation on Next.js App Router. Browser and server Supabase clients are separated. Server Components, Server Actions, Route Handlers, and `proxy.ts` establish identity with `getUser()`. Application `users` maps the Supabase Auth user ID only. Unauthenticated visitors cannot reach application routes. There is no public signup, no RBAC, and no company authorization. Login is rate-limited through an in-process `LoginRateLimiter` boundary. Password reset remains TASK-004.

Files changed:

Created `src/domain/auth/*`, `src/server/auth/*`, `src/lib/supabase/*`, `src/proxy.ts`, login/logout UI, `/api/auth/login` and `/api/auth/logout`, `docs/Technical/Authentication.md`, auth unit/integration tests. Updated env validation, Prisma schema, logger redaction, README, [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Security]], [[API and Integrations]], [[Database]], [[Phase 01 Foundation]], [[TASK-003 Authentication Base]].

Database changes:

Migration `20260820193000_authentication_base` creates `users` (identity mapping only). Applied with `pnpm prisma:migrate:deploy`. No roles, permissions, companies, invoices, or payments tables.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 41 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 5 passed, 1 skipped (live Supabase login; public Auth credentials unset). `pnpm build` pass (`/` and `/login` dynamic). Playwright E2E NOT RUN (browsers not installed). Live Auth E2E NOT RUN (no `AUTH_TEST_EMAIL` / `AUTH_TEST_PASSWORD`).

Decisions:

No new ADR. In-process login rate limiting is an implementation of the TASK-003 rate-limit boundary, replaceable later with Redis without changing login use cases. Auto-creating the application `users` row on first successful Auth login is identity linkage, not public signup or role assignment.

Problems:

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` were not set in this environment, so live Auth login was skipped rather than marked passed.

Next task:

[[TASK-004 Password Reset and Session Controls]] (not started)

### 2026-08-20 — TASK-002 verification

Work completed:

Fixed Vitest integration-test env loading. Prisma CLI already loaded `.env` / `.env.local`; Vitest did not, so `DATABASE_URL` was undefined and connectivity tests failed despite a working Supabase database and applied foundation migration. Added centralized `loadEnvFiles()` and a dedicated integration Vitest config. Unit tests still do not load developer database credentials.

Files changed:

`src/config/load-env-files.ts`, `tests/setup/integration-env.ts`, `vitest.integration.config.mts`, `vitest.config.mts`, `prisma.config.ts`, `package.json`, `docs/Technical/Database.md`, this log, [[TASK-002 Database Foundation]], [[04 Implementation Status]].

Database changes:

None in this verification pass. Foundation migration was already applied via `pnpm prisma:migrate:dev`.

Tests:

`pnpm prisma:generate` pass. `pnpm prisma:validate` pass. `pnpm typecheck` pass. `pnpm lint` pass. `pnpm test` 18 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 3 passed. `pnpm build` pass.

Decisions:

None. Runtime tests still use `DATABASE_URL`; CLI still uses `DIRECT_URL`.

Problems:

None remaining for TASK-002.

Next task:

[[TASK-003 Authentication Base]] (not started)

### 2026-08-20 — TASK-002

Work completed:

Established Prisma 7 against Supabase PostgreSQL: schema conventions (UUID, timestamptz, Decimal/NUMERIC, company_id on transactional tables), pooled `DATABASE_URL` vs direct `DIRECT_URL`, server-only Prisma client, foundation migration enabling `pgcrypto` only. No users/companies/invoices/payments tables.

Files changed:

Created `prisma/`, `prisma.config.ts`, `src/server/db/*`, `docs/Technical/Database.md`, DB unit/integration tests. Updated env validation, `.env.example`, CI, README, [[00 Home]], [[04 Implementation Status]], [[TASK-002 Database Foundation]], [[Phase 01 Foundation]], [[03 Implementation Plan]], ADR-002 consequences.

Database changes:

Foundation migration file only. Not applied (no reachable Postgres). `prisma migrate status` failed closed (P1001).

Tests:

`pnpm typecheck`, `pnpm lint`, `pnpm test` (16 passed, 3 integration skipped), `pnpm build`, `pnpm prisma generate`, `pnpm prisma validate`. Live connectivity not run (`RUN_DB_INTEGRATION` unset).

Decisions:

No new ADR. Documented Prisma 7 CLI vs runtime URL split under ADR-002.

Problems:

No local/Supabase credentials in this environment. Integration tests skipped rather than marked passed.

Next task:

[[TASK-003 Authentication Base]]

### 2026-08-20 — TASK-001

Work completed:

Established the Next.js App Router + TypeScript + pnpm repository foundation. Added centralized Zod environment configuration with required-now vs optional future secrets, UTC timestamp helpers, Pino logger, ESLint/Prettier, Vitest smoke tests, Playwright config, GitHub Actions CI placeholder, Tailwind/shadcn foundation, and a non-functional application shell. No product modules, Prisma schema, authentication, payments, or Docker compose.

Files changed:

Created application skeleton under the repository root (`package.json`, `src/`, `tests/`, `.github/workflows/ci.yml`, `.env.example`). Updated this log, [[00 Home]], [[04 Implementation Status]], [[TASK-001 Repository Foundation]], [[Phase 01 Foundation]], and [[03 Implementation Plan]].

Database changes:

None.

Tests:

`pnpm typecheck`, `pnpm lint`, `pnpm test` (7 passing), `pnpm build`. Playwright E2E not run (N/A for TASK-001; browsers not installed).

Decisions:

No new ADR. Existing ADRs 001, 012, 014, 016, 018, 019, 020, 021 were followed. Optional provider secrets do not fail local/CI startup. Docker/Caddy remain deferred to later deployment tasks.

Problems:

pnpm was not on PATH initially; installed via npm. Native `unrs-resolver` postinstall requires `allowBuilds` in `pnpm-workspace.yaml` (pnpm 11). Git was not initialized; commit was prepared but not created.

Next task:

[[TASK-002 Database Foundation]]

## Related

- [[04 Implementation Status]]
- [[03 Implementation Plan]]
- [[05 Architecture Decisions]]
- [[00 Home]]

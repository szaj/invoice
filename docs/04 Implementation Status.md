---
type: status
status: planned
tags:
  - task
---

# Implementation Status

Central development memory for **application** implementation. Documentation existing is not completion.

Every task ID appears exactly once in this file.

## Status Values

- NOT STARTED
- PLANNED
- IN PROGRESS
- BLOCKED
- DEFERRED
- COMPLETE

**DEFERRED** means the task is formally out of the current Version 1 build path pending an accepted product/architecture decision (for example a concrete vendor/API). It is **not** COMPLETE and must not be treated as implemented functionality.

Do not mark anything complete merely because documentation exists.

TASK-001 through [[TASK-058 Hosted Checkout]] are COMPLETE. [[TASK-056 Bank Processor Adapter]] and [[TASK-057 Bank Processor Webhook]] remain **DEFERRED** (no live bank processor until a concrete vendor/API is selected; no fictional adapter). The next buildable task is [[TASK-059 Partial Payments]]. **UI/UX Foundation Refresh — before TASK-042** remains COMPLETE as a non-numbered presentation checkpoint; see [[UI UX Design System]].

Control: [[03 Implementation Plan]] · [[06 Development Log]] · [[00 Home]]

## Phase 01 — Platform Foundation

Phase index: [[Phase 01 Foundation]]

| Task | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| [[TASK-001 Repository Foundation]] | COMPLETE | 2026-08-20 | 2026-08-20 | | Next.js / pnpm / Zod env / CI skeleton. No product features. |
| [[TASK-002 Database Foundation]] | COMPLETE | 2026-08-20 | 2026-08-20 | | Prisma 7 + Supabase PG. Live connectivity and foundation migration verified. |
| [[TASK-003 Authentication Base]] | COMPLETE | 2026-08-20 | 2026-08-20 | | Supabase Auth identity only. Live Supabase authentication verified. |
| [[TASK-004 Password Reset and Session Controls]] | COMPLETE | 2026-08-20 | 2026-08-20 | | Supabase Auth recovery/reset. Live password update verified; recovery-email click SKIPPED. |
| [[TASK-005 Roles and Permissions Model]] | COMPLETE | 2026-08-20 | 2026-08-20 | | Admin/Compliance/Staff matrix in application DB. Optional Staff policies denied (US-007–010). |
| [[TASK-006 User Management]] | COMPLETE | 2026-08-20 | 2026-08-20 | | Admin CRUD/suspend/reset. MFA status only. No company assignment. |
| [[TASK-007 Company CRUD]] | COMPLETE | 2026-08-20 | 2026-08-20 | | Admin identity/address/status CRUD. No currencies, gateways, branding files, or assignments. |
| [[TASK-008 User Company Assignments]] | COMPLETE | 2026-08-20 | 2026-08-20 | | user_companies. Admin ALL; Staff/Compliance assigned-only. No switcher. |
| [[TASK-009 Tenant Isolation and Company Context]] | COMPLETE | 2026-08-20 | 2026-08-20 | | Header switcher; cookie context; All Companies reporting-only; transactional concrete company required. |
| [[TASK-010 Company Branding Configuration]] | COMPLETE | 2026-08-20 | 2026-08-20 | | Admin branding subresource: prefix, terms, email template ref, contact, logo metadata via StorageService. No PDF/email/sequence. |
| [[TASK-011 Reporting Groups]] | COMPLETE | 2026-08-20 | 2026-08-20 | | company_groups + reporting_group_id. Admin CRUD/assign. Membership is not authorization. No VX seed. |
| [[TASK-012 Audit Event Foundation]] | COMPLETE | 2026-08-20 | 2026-08-20 | | Append-only `audit_logs`; login + user/company admin writers; no viewer. |
| [[TASK-013 Core System Settings]] | COMPLETE | 2026-08-20 | 2026-08-20 | | `system_settings` + Admin UI; ADR-011 still OPEN. |

## Phase 02 — Financial Foundation

Phase index: [[Phase 02 Financial Foundation]]

| Task | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| [[TASK-014 Currency Master]] | COMPLETE | 2026-08-20 | 2026-08-20 | | Global `currencies` seed USD/AED/PKR/GBP/AUD; Admin CRUD/disable. |
| [[TASK-015 Company Currency Configuration]] | COMPLETE | 2026-08-20 | 2026-08-20 | | `company_currencies` enabled subset + default; Admin `company.write`. |
| [[TASK-016 Fixed Conversion Rate Schema]] | COMPLETE | 2026-08-20 | 2026-08-20 | | `fixed_conversion_rates` Admin create; NUMERIC(20,12); no live FX. |
| [[TASK-017 Fixed Rate Versioning]] | COMPLETE | 2026-08-20 | 2026-08-20 | | Append-only versions; expire previous on create; history list. |
| [[TASK-018 Effective Rate Selection]] | COMPLETE | 2026-08-20 | 2026-08-20 | | `resolve_rate(pair, at)`; same-currency 1; missing blocks. |
| [[TASK-019 Money Calculation Utilities]] | COMPLETE | 2026-08-20 | 2026-08-20 | | Prisma Decimal money layer; conversion formula; fee excluded. |
| [[TASK-020 Settlement Currency Configuration]] | COMPLETE | 2026-08-20 | 2026-08-20 | | Per-method settlement currencies on `payment_gateway_configs`; Admin `gateway.credentials.manage`; no credentials/charges. |
| [[TASK-021 Currency Disable and Historical Visibility]] | COMPLETE | 2026-08-21 | 2026-08-21 | | Status flags only; new-selection rejects disabled; historical display retained (BR-011). |

## Phase 03 — Customers

Phase index: [[Phase 03 Customers]]

| Task | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| [[TASK-022 Customer Domain Schema]] | COMPLETE | 2026-08-21 | 2026-08-21 | | `customers` master §7.1; email optional; soft status; no public CRUD. |
| [[TASK-023 Customer CRUD Service]] | COMPLETE | 2026-08-21 | 2026-08-21 | | CRUD/search APIs; soft-deactivate; company-scoped until TASK-025. |
| [[TASK-024 Customer List and Form UI]] | COMPLETE | 2026-08-21 | 2026-08-21 | | List/search/filter + create/edit UI; Server Actions → TASK-023; no profile/amounts. |
| [[TASK-025 Customer Company Relationships]] | COMPLETE | 2026-08-21 | 2026-08-21 | | `customer_companies`; link APIs; access via linked companies (replaces interim scope). |
| [[TASK-026 Customer Profile]] | COMPLETE | 2026-08-21 | 2026-08-21 | | Profile endpoint + UI; placeholders; authorized company filter; activity from audit. |
| [[TASK-027 Customer Notes]] | COMPLETE | 2026-08-21 | 2026-08-21 | | `customer_notes` internal-only; create/list; profile UI; assignment-scoped. |
| [[TASK-028 Customer Duplicate Detection and Status]] | COMPLETE | 2026-08-21 | 2026-08-21 | | Duplicate warn (email/phone/name); Admin/Compliance ack; soft status + invoice gate. |
| [[TASK-029 Customer Financial Summary]] | COMPLETE | 2026-08-21 | 2026-08-21 | | By-currency summary widgets; empty until invoices; BR-013; summary/invoices/payments APIs. |

## Phase 04 — Invoicing

Phase index: [[Phase 04 Invoicing]]

| Task | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| [[TASK-030 Invoice Domain Schema]] | COMPLETE | 2026-08-21 | 2026-08-21 | | `invoices` header §8.2; company+customer; draft; internal store only. |
| [[TASK-031 Invoice Draft Service]] | COMPLETE | 2026-08-21 | 2026-08-21 | | Draft GET/POST/PATCH APIs; BR-001/002; ACTIVE customer gate; Staff own/assigned edit. |
| [[TASK-032 Invoice Draft UI]] | COMPLETE | 2026-08-21 | 2026-08-21 | | List/filter + create/edit/view drafts; internal notes labeled; totals placeholder. |
| [[TASK-033 Invoice Line Items]] | COMPLETE | 2026-08-21 | 2026-08-21 | | `invoice_items`; server line totals; draft nested replace; discount blocked (ADR-010). |
| [[TASK-034 Invoice Totals]] | COMPLETE | 2026-08-21 | 2026-08-21 | | Stored totals; recalculate on item change; discount=0 (ADR-010); BR-009 outstanding. |
| [[TASK-035 Invoice Numbering]] | COMPLETE | 2026-08-21 | 2026-08-21 | | Per-company sequence; prefix from branding; optional year; BR-003; concurrent-safe. |
| [[TASK-036 Invoice Lifecycle]] | COMPLETE | 2026-08-21 | 2026-08-21 | | Issue Draft→ISSUED; BR-018 overdue; status filters. Cancel→TASK-038. |
| [[TASK-037 Invoice Versions]] | COMPLETE | 2026-08-21 | 2026-08-21 | | Immutable snapshots on issue; reject issued financial PATCH; metadata Admin/Compliance. |
| [[TASK-038 Invoice Cancellation]] | COMPLETE | 2026-08-21 | 2026-08-21 | | Soft cancel + reason; BR-019; Staff denied. |
| [[TASK-039 PDF Generation]] | COMPLETE | 2026-08-21 | 2026-08-21 | | React-pdf + invoice_files; once per version; StorageService. |
| [[TASK-040 PDF Preview and Download]] | COMPLETE | 2026-08-21 | 2026-08-21 | | Preview/download stored PDFs; Staff unassigned 403. |
| [[TASK-041 Email Delivery]] | COMPLETE | 2026-08-21 | 2026-08-21 | | EmailService→Resend; email_logs; stored PDF attach; BR-017. |
| [[TASK-042 Email Invoice UI]] | COMPLETE | 2026-08-21 | 2026-08-21 | | Modal + history on invoice view; CC/BCC via `invoice.edit_issued`; reuses TASK-041 send. |
| [[TASK-043 Invoice Duplicate and Print]] | COMPLETE | 2026-08-21 | 2026-08-21 | | Duplicate → new Draft; print/download via stored PDF. |

## Phase 05 — Payments

Phase index: [[Phase 05 Payments]]

| Task | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| [[TASK-044 Payment Domain Schema]] | COMPLETE | 2026-08-21 | 2026-08-21 | | `payments` §10.3; provider-agnostic; Decimal; fee separate; no charges. |
| [[TASK-045 Payment Service]] | COMPLETE | 2026-08-24 | 2026-08-24 | | Domain service + GET/confirm/fail APIs; BR-004/005 lock; no charges/UI. |
| [[TASK-046 Settlement Conversion Snapshot]] | COMPLETE | 2026-08-24 | 2026-08-24 | | Admin fixed-rate snapshot + `rate_effective_at`; BR-020/021 lock; no market FX. |
| [[TASK-047 Merchant Fee Reconciliation Fields]] | COMPLETE | 2026-08-24 | 2026-08-24 | | Optional fee/actual received stored only; excluded from conversion and outstanding (BR-020). |
| [[TASK-048 Payment Provider Abstraction]] | COMPLETE | 2026-08-24 | 2026-08-24 | | PaymentProvider registry + capabilities; Manual/Fake adapters; no live SDKs. |
| [[TASK-049 Gateway Configuration Per Company]] | COMPLETE | 2026-08-24 | 2026-08-24 | | Per-company gateway config on `payment_gateway_configs`; ADR-022 envelope encryption; Admin `gateway.credentials.manage`; safe metadata only. |
| [[TASK-050 Manual Payment Recording]] | COMPLETE | 2026-08-24 | 2026-08-24 | | `POST /api/payments/manual` create→confirm SUCCESSFUL; Manual adapter path; Staff denied (US-007); no invoice balance mutation. |
| [[TASK-051 Manual Payment UI]] | COMPLETE | 2026-08-24 | 2026-08-24 | | Invoice Record payment + `/payments/manual`; reuses TASK-050; design-system forms; Staff denied; no balance mutation. |
| [[TASK-052 Stripe Adapter]] | COMPLETE | 2026-08-24 | 2026-08-24 | | Stripe PaymentProvider adapter (Checkout request/status); ADR-022 credentials; no webhook pipeline. |
| [[TASK-053 Stripe Webhook]] | COMPLETE | 2026-08-24 | 2026-08-24 | | `payment_events` + Stripe webhook route; signature auth; idempotent confirm/fail; E2E-10. |
| [[TASK-054 PayPal Adapter]] | COMPLETE | 2026-08-24 | 2026-08-24 | | PayPal PaymentProvider adapter (Orders request/status); ADR-022 credentials; no webhook pipeline. |
| [[TASK-055 PayPal Webhook]] | COMPLETE | 2026-08-24 | 2026-08-24 | | PayPal webhook route; signature auth; idempotent confirm/fail; E2E-10. |
| [[TASK-056 Bank Processor Adapter]] | DEFERRED | 2026-08-24 | | | No live bank adapter until concrete vendor/API selected; do not invent. |
| [[TASK-057 Bank Processor Webhook]] | DEFERRED | 2026-08-24 | | | Deferred with TASK-056 (no adapter → no webhook). |
| [[TASK-058 Hosted Checkout]] | COMPLETE | 2026-08-24 | 2026-08-24 | | Hosted checkout + PENDING snapshot; email method selection; no Paid before webhook. |
| [[TASK-059 Partial Payments]] | NOT STARTED | | | |  |
| [[TASK-060 Payment Allocation]] | NOT STARTED | | | |  |
| [[TASK-061 Payment List UI]] | NOT STARTED | | | |  |
| [[TASK-062 Payment Detail UI]] | NOT STARTED | | | |  |

## Phase 06 — Payment Adjustments

Phase index: [[Phase 06 Payment Adjustments]]

| Task | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| [[TASK-063 Dispute Open Workflow]] | NOT STARTED | | | |  |
| [[TASK-064 Full Refunds]] | NOT STARTED | | | |  |
| [[TASK-065 Partial Refunds]] | NOT STARTED | | | |  |
| [[TASK-066 Chargeback Debit Loss]] | NOT STARTED | | | |  |
| [[TASK-067 Chargeback Won Reversal]] | NOT STARTED | | | |  |
| [[TASK-068 Adjustment History and Notes]] | NOT STARTED | | | |  |
| [[TASK-069 Payment Adjustment UI]] | NOT STARTED | | | |  |
| [[TASK-070 CBRF Calculation Engine]] | NOT STARTED | | | |  |

## Phase 07 — Compliance and Audit

Phase index: [[Phase 07 Compliance and Audit]]

| Task | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| [[TASK-071 Compliance Status Model]] | NOT STARTED | | | |  |
| [[TASK-072 Compliance Review Queue]] | NOT STARTED | | | |  |
| [[TASK-073 Compliance Notes and Reason Codes]] | NOT STARTED | | | |  |
| [[TASK-074 Compliance Review UI]] | NOT STARTED | | | |  |
| [[TASK-075 Compliance Export]] | NOT STARTED | | | |  |
| [[TASK-076 Audit Log Viewer]] | NOT STARTED | | | |  |

## Phase 08 — Reporting

Phase index: [[Phase 08 Reporting]]

| Task | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| [[TASK-077 Dashboard KPIs]] | NOT STARTED | | | |  |
| [[TASK-078 Invoice Report]] | NOT STARTED | | | |  |
| [[TASK-079 Payment Report]] | NOT STARTED | | | |  |
| [[TASK-080 Outstanding Report]] | NOT STARTED | | | |  |
| [[TASK-081 Overdue Aging]] | NOT STARTED | | | |  |
| [[TASK-082 Customer Report]] | NOT STARTED | | | |  |
| [[TASK-083 Company Performance]] | NOT STARTED | | | |  |
| [[TASK-084 Staff Performance]] | NOT STARTED | | | |  |
| [[TASK-085 Gateway Report]] | NOT STARTED | | | |  |
| [[TASK-086 Currency Report]] | NOT STARTED | | | |  |
| [[TASK-087 Compliance Report]] | NOT STARTED | | | |  |
| [[TASK-088 Monthly Brand Matrix]] | NOT STARTED | | | |  |
| [[TASK-089 Reporting Group Rollups]] | NOT STARTED | | | |  |
| [[TASK-090 Report Exports]] | NOT STARTED | | | |  |

## Phase 09 — Hardening and Deployment

Phase index: [[Phase 09 Hardening and Deployment]]

| Task | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| [[TASK-091 Operational Notifications]] | NOT STARTED | | | |  |
| [[TASK-092 Notification Settings]] | NOT STARTED | | | |  |
| [[TASK-093 Authorization Testing]] | NOT STARTED | | | |  |
| [[TASK-094 Financial Calculation Testing]] | NOT STARTED | | | |  |
| [[TASK-095 Webhook Testing]] | NOT STARTED | | | |  |
| [[TASK-096 E2E Test Suite]] | NOT STARTED | | | |  |
| [[TASK-097 PDF Visual QA]] | NOT STARTED | | | |  |
| [[TASK-098 Performance Hardening]] | NOT STARTED | | | |  |
| [[TASK-099 Queue Hardening]] | NOT STARTED | | | |  |
| [[TASK-100 Monitoring]] | NOT STARTED | | | |  |
| [[TASK-101 Backup and Recovery]] | NOT STARTED | | | |  |
| [[TASK-102 Staging UAT Environment]] | NOT STARTED | | | |  |
| [[TASK-103 Production Deployment]] | NOT STARTED | | | |  |

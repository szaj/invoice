---
type: architecture
status: planned
tags:
  - architecture
  - task
---

# Implementation Plan

This is the development roadmap. Do not implement application code from this note.

Each phase is an index. Executable work lives in individual files:

```text
docs/Tasks/TASK-XXX Task Name.md
```

A task is one focused implementation cycle, not an entire module. Authoritative requirements remain in the linked specification notes. See [[01 Master Spec]].

## Order Validation

The previous backlog had the right phase sequence but several **task-level** dependency problems. Those are corrected here:

| Issue | Correction |
| --- | --- |
| Database foundation was buried in repository setup | [[TASK-002 Database Foundation]] is separate and follows [[TASK-001 Repository Foundation]] |
| User-company assignments were numbered before company CRUD while depending on it | Company CRUD is [[TASK-007 Company CRUD]]; assignments are [[TASK-008 User Company Assignments]] |
| Tenant isolation was implicit | [[TASK-009 Tenant Isolation and Company Context]] is explicit |
| Roles after users would force a second pass on `role_id` | [[TASK-005 Roles and Permissions Model]] precedes [[TASK-006 User Management]] |
| Money utilities sat after settlement config | [[TASK-019 Money Calculation Utilities]] follows rate versioning/selection |
| Stripe/PayPal mixed adapter + webhook | Separate adapter and webhook tasks |
| Gateway config came after adapters | [[TASK-049 Gateway Configuration Per Company]] precedes Stripe/PayPal/bank adapters |
| Partial payments and allocation were one task | [[TASK-059 Partial Payments]] then [[TASK-060 Payment Allocation]] |
| Notifications sat inside compliance | [[TASK-091 Operational Notifications]] follows reporting |

Validated build order:

```text
Repository → Database
  → Authentication → Roles → Users
  → Companies → User-company access → Tenant isolation
  → Reporting groups → Audit foundation
  → Currencies → Company currencies → Fixed rates → Versioning → Money utilities
  → Customers
  → Invoices → Items → Numbering → Lifecycle → Versions → PDF → Email
  → Payments schema/service → Provider abstraction → Manual payments
  → Stripe/PayPal/bank adapters and webhooks → Partial payments → Allocation
  → Disputes → Refunds → Chargebacks → Reversals → CB/RF
  → Compliance → Reporting → Notifications → Hardening → Deployment
```

Nothing in this plan adds Version 1 out-of-scope work. See [[Out of Scope]].

## Phase 01 — Platform Foundation

[[Phase 01 Foundation]]

Tasks: [[TASK-001 Repository Foundation]] through [[TASK-013 Core System Settings]]

Depends on: none

## Phase 02 — Financial Foundation

[[Phase 02 Financial Foundation]]

Tasks: [[TASK-014 Currency Master]] through [[TASK-021 Currency Disable and Historical Visibility]]

Depends on: Phase 01

## Phase 03 — Customers

[[Phase 03 Customers]]

Tasks: [[TASK-022 Customer Domain Schema]] through [[TASK-029 Customer Financial Summary]]

Depends on: Phase 01

## Phase 04 — Invoicing

[[Phase 04 Invoicing]]

Tasks: [[TASK-030 Invoice Domain Schema]] through [[TASK-043 Invoice Duplicate and Print]]

Depends on: Phase 01, Phase 02, Phase 03

## Phase 05 — Payments

[[Phase 05 Payments]]

Tasks: [[TASK-044 Payment Domain Schema]] through [[TASK-062 Payment Detail UI]]

Depends on: Phase 02, Phase 04

## Phase 06 — Payment Adjustments

[[Phase 06 Payment Adjustments]]

Tasks: [[TASK-063 Dispute Open Workflow]] through [[TASK-070 CBRF Calculation Engine]]

Depends on: Phase 05

## Phase 07 — Compliance and Audit

[[Phase 07 Compliance and Audit]]

Tasks: [[TASK-071 Compliance Status Model]] through [[TASK-076 Audit Log Viewer]]

Depends on: Phase 01, Phase 04, Phase 05

## Phase 08 — Reporting

[[Phase 08 Reporting]]

Tasks: [[TASK-077 Dashboard KPIs]] through [[TASK-090 Report Exports]]

Depends on: Phase 04, Phase 05, Phase 06, Phase 07

## Phase 09 — Notifications, Hardening, and Deployment

[[Phase 09 Hardening and Deployment]]

Tasks: [[TASK-091 Operational Notifications]] through [[TASK-103 Production Deployment]]

Depends on: Phases 01–08

## First Buildable Task

[[TASK-001 Repository Foundation]] through [[TASK-058 Hosted Checkout]] are COMPLETE.

[[TASK-056 Bank Processor Adapter]] and [[TASK-057 Bank Processor Webhook]] are **DEFERRED** (Version 1 live providers: MANUAL, STRIPE, PAYPAL; `BANK_PROCESSOR` remains a config slot only until a concrete vendor/API is accepted — do not invent a fictional bank API).

**UI/UX Foundation Refresh — before TASK-042** remains the presentation checkpoint that established [[UI UX Design System]].

[[TASK-059 Partial Payments]] is the next buildable product task (NOT STARTED).

## Explicitly Not Planned for Version 1

Do not create implementation tasks for:

- Customer login portal or customer account dashboard
- General ledger / double-entry accounting
- Expense management and vendor bills
- Inventory / stock management
- Payroll
- Purchase orders
- Tax filing or statutory accounting submissions
- Automated debt collection beyond email reminders
- Native mobile apps
- Live/automatic FX providers

Source: [[Out of Scope]], [[Product Goals]], [[Currency and Conversion]]

## Status Tracker

All tasks appear exactly once in [[04 Implementation Status]].

Documentation existing is not application completion.

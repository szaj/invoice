---
type: plan
status: approved
tags:
  - architecture
  - task
---

# Current Plan

Active roadmap only. Historical plan narrative: [[03 Implementation Plan]] (archived).

Executable work lives in `docs/Active/Tasks/`. See also [[Vault Completion Workflow]].

## Current phase

**Phase 08 — Reporting**

## Next buildable task

[[TASK-091 Operational Notifications]] (NOT STARTED)

Do not start TASK-091 until ready. Do not skip ahead.

## Remaining sequence

### Phase 06 — Payment Adjustments

| ID | Task | Status |
| --- | --- | --- |
| TASK-070 | [[TASK-070 CBRF Calculation Engine]] | COMPLETE |

### Phase 07 — Compliance and Audit

TASK-071 through TASK-076 COMPLETE.

### Phase 08 — Reporting

TASK-077–090 COMPLETE.

### Phase 09 — Notifications, Hardening, Deployment

TASK-091 → TASK-103 (all NOT STARTED)

Phase indexes: [[Phase 06 Payment Adjustments]], [[Phase 07 Compliance and Audit]], [[Phase 08 Reporting]], [[Phase 09 Hardening and Deployment]]. Phase 05 remains active only for deferred bank tasks: [[Phase 05 Payments]].

## Deferred (still relevant)

| ID | Task | Reason |
| --- | --- | --- |
| TASK-056 | [[TASK-056 Bank Processor Adapter]] | No concrete bank vendor/API (US-017) |
| TASK-057 | [[TASK-057 Bank Processor Webhook]] | Deferred with TASK-056 |

Do not invent a fictional bank adapter. Version 1 live providers: MANUAL, STRIPE, PAYPAL.

## Blockers / unresolved decisions

| Item | Status | Impact |
| --- | --- | --- |
| ADR-009 Issued invoice financial edit | OPEN | Do not invent edit policy |
| ADR-010 Discount model | OPEN | Discounts stay blocked / zero |
| ADR-011 Reporting/base currency default | OPEN | Reporting tasks must not invent default |
| US-015 Overpayment allow | OPEN | Default reject only (BR-010) |
| US-007–010 Staff optional grants | OPEN | Default denied |
| US-017 Bank processor vendor | DEFERRED | TASK-056/057 |

None of the above currently blocks TASK-088.

## Explicitly not planned (Version 1)

Customer portal, GL, expenses, inventory, payroll, POs, tax filing, automated collections beyond reminders, native mobile, live FX — see product Out of Scope.

## When a TASK becomes COMPLETE

1. Update [[03 Current Implementation Status]]
2. Update this plan (next task / phase)
3. Update [[01 Current Architecture]] / [[02 Current Product Rules]] only if facts changed
4. Move the TASK file from `docs/Active/Tasks/` → `docs/Archive/Completed Tasks/`
5. Keep task ID and history intact
6. Do not leave completed TASK details in active Cursor context

See `.cursor/rules/task-execution.mdc`. Proposed helper script (dry-run first): see report / do not run destructive moves without path+status validation.

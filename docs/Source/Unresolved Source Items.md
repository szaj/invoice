---
type: reference
status: approved
tags:
  - product
---

# Unresolved Source Items

This note records source items that are incomplete, internally open, or duplicated wording. It does not invent a chosen implementation.

No two source documents were found to contradict a financial, permission, payment, security, or compliance rule.

## Resolved by accepted ADRs (2026-08-20)

| ID | Topic | Resolution |
| --- | --- | --- |
| US-001 | Application framework | [[05 Architecture Decisions#ADR-001 — Application framework|ADR-001]] ACCEPTED — Next.js App Router + TypeScript + pnpm |
| US-002 | Database product | [[05 Architecture Decisions#ADR-002 — Database|ADR-002]] ACCEPTED — Supabase PostgreSQL + Prisma |
| US-003 | Authentication mechanism | [[05 Architecture Decisions#ADR-003 — Authentication|ADR-003]] ACCEPTED — Supabase Auth identity; application-owned authorization |
| US-012 | Queue technology | [[05 Architecture Decisions#ADR-005 — Background jobs|ADR-005]] ACCEPTED — BullMQ + Redis + worker |
| US-013 | Object storage provider | [[05 Architecture Decisions#ADR-006 — Object storage|ADR-006]] ACCEPTED — Cloudflare R2 via S3-compatible abstraction |
| US-014 | Email provider | [[05 Architecture Decisions#ADR-007 — Transactional email|ADR-007]] ACCEPTED — Resend via EmailService |

## Still open product / policy choices

| ID | Topic | What the source says | Tracked as |
| --- | --- | --- | --- |
| US-004 | Issued invoice financial edits | Minor non-financial metadata may be edited with audit history. Financial changes require either a controlled revised invoice version with reason, or cancellation and reissue. Final choice must be consistent across companies. | [[05 Architecture Decisions#ADR-009 — Issued invoice financial edit policy|ADR-009]] |
| US-005 | Discount model | Optional line or invoice level; percentage or fixed; implementation should choose one consistent model or support both explicitly. | [[05 Architecture Decisions#ADR-010 — Discount model|ADR-010]] |
| US-006 | Reporting/base currency | Configurable; initial recommendation USD. | [[05 Architecture Decisions#ADR-011 — Reporting/base currency default|ADR-011]] |
| US-007 | Staff manual payment | Roles matrix: "Optional permission". TASK-005 recorded as **denied** (no invented grant). | Policy during [[TASK-050 Manual Payment Recording]] |
| US-008 | Staff view of assigned invoices | Roles matrix: "Optional by policy". TASK-005 recorded as **denied** (no invented grant). | Policy during later invoice access tasks |
| US-009 | Staff report export | Roles matrix: "Optional". TASK-005 recorded as **denied** (no invented grant). | Policy during [[TASK-090 Report Exports]] |
| US-010 | Staff audit visibility | Roles matrix: "Own activity only/none". TASK-005 recorded as **denied** (no invented grant). | Policy during [[TASK-076 Audit Log Viewer]] |
| US-011 | Due-on-receipt invoices | Due date is mandatory unless company policy allows due-on-receipt. | Remains OPEN after [[TASK-036 Invoice Lifecycle]]: due date stayed mandatory; due-on-receipt not enabled. |
| US-015 | Overpayment | A payment cannot apply more than the open balance unless overpayment is explicitly supported and authorized. | Policy during [[TASK-059 Partial Payments]] / [[TASK-060 Payment Allocation]] |

## Deferred operational choices (not TASK-001 blockers)

Exact VPS vendor, DNS/domain provider, future payment gateways beyond Version 1, exact future bank/card processor brand, future alternative email or S3 providers. Abstractions are accepted; vendors for those futures are not Version 1 scope.

## Duplicated Wording In Source Notes

Some original notes repeat the same callout twice (company isolation, rate locking, mixed-currency reporting). Meaning is the same in both copies. Authoritative text is retained in the module notes; duplicates were not treated as a conflict.

## Out Of Scope Confirmation

[[Out of Scope]] and [[Product Goals]] list the same Version 1 exclusions. No conflict.

## Related

- [[01 Master Spec]]
- [[05 Architecture Decisions]]
- [[multi_brand_invoice_saas_development_spec]]

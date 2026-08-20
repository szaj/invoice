---
type: task
status: not-started
phase: 5
tags:
  - task
---

# Phase 05 — Payments

Payments: schema → service → snapshot/fees → provider abstraction → gateway config → manual payments → Stripe/PayPal/bank adapters and their webhooks → hosted checkout → partial payments → allocation → UI.

Tasks: TASK-044 through TASK-062

Individual task files are the executable backlog. This note is the phase index.

Control: [[03 Implementation Plan]] · [[04 Implementation Status]] · [[01 Master Spec]]

| ID | Task | Dependencies | Status |
|---|---|---|---|
| TASK-044 | [[TASK-044 Payment Domain Schema]] | TASK-030, TASK-019, TASK-020 | NOT STARTED |
| TASK-045 | [[TASK-045 Payment Service]] | TASK-044, TASK-012 | NOT STARTED |
| TASK-046 | [[TASK-046 Settlement Conversion Snapshot]] | TASK-018, TASK-045, TASK-019 | NOT STARTED |
| TASK-047 | [[TASK-047 Merchant Fee Reconciliation Fields]] | TASK-044 | NOT STARTED |
| TASK-048 | [[TASK-048 Payment Provider Abstraction]] | TASK-045 | NOT STARTED |
| TASK-049 | [[TASK-049 Gateway Configuration Per Company]] | TASK-007, TASK-020, TASK-012, TASK-048 | NOT STARTED |
| TASK-050 | [[TASK-050 Manual Payment Recording]] | TASK-045, TASK-046, TASK-018 | NOT STARTED |
| TASK-051 | [[TASK-051 Manual Payment UI]] | TASK-050 | NOT STARTED |
| TASK-052 | [[TASK-052 Stripe Adapter]] | TASK-048, TASK-049 | NOT STARTED |
| TASK-053 | [[TASK-053 Stripe Webhook]] | TASK-052, TASK-045, TASK-012 | NOT STARTED |
| TASK-054 | [[TASK-054 PayPal Adapter]] | TASK-048, TASK-049 | NOT STARTED |
| TASK-055 | [[TASK-055 PayPal Webhook]] | TASK-054, TASK-045 | NOT STARTED |
| TASK-056 | [[TASK-056 Bank Processor Adapter]] | TASK-048, TASK-049 | NOT STARTED |
| TASK-057 | [[TASK-057 Bank Processor Webhook]] | TASK-056, TASK-045 | NOT STARTED |
| TASK-058 | [[TASK-058 Hosted Checkout]] | TASK-052, TASK-054, TASK-046, TASK-041 | NOT STARTED |
| TASK-059 | [[TASK-059 Partial Payments]] | TASK-050, TASK-053 | NOT STARTED |
| TASK-060 | [[TASK-060 Payment Allocation]] | TASK-059, TASK-034 | NOT STARTED |
| TASK-061 | [[TASK-061 Payment List UI]] | TASK-045 | NOT STARTED |
| TASK-062 | [[TASK-062 Payment Detail UI]] | TASK-061, TASK-046, TASK-047 | NOT STARTED |

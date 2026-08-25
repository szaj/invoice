---
type: task
status: in-progress
phase: 4
tags:
  - task
---

# Phase 04 — Invoicing

Invoicing, then PDF, then email. Payments are not implemented here except as zero paid/outstanding.

Tasks: TASK-030 through TASK-043

Individual task files are the executable backlog. This note is the phase index.

Control: [[03 Implementation Plan]] · [[04 Implementation Status]] · [[01 Master Spec]]

| ID | Task | Dependencies | Status |
|---|---|---|---|
| TASK-030 | [[TASK-030 Invoice Domain Schema]] | TASK-022, TASK-015, TASK-009 | COMPLETE |
| TASK-031 | [[TASK-031 Invoice Draft Service]] | TASK-030, TASK-023, TASK-028 | COMPLETE |
| TASK-032 | [[TASK-032 Invoice Draft UI]] | TASK-031 | COMPLETE |
| TASK-033 | [[TASK-033 Invoice Line Items]] | TASK-031 | COMPLETE |
| TASK-034 | [[TASK-034 Invoice Totals]] | TASK-033, TASK-019 | COMPLETE |
| TASK-035 | [[TASK-035 Invoice Numbering]] | TASK-010, TASK-031 | COMPLETE |
| TASK-036 | [[TASK-036 Invoice Lifecycle]] | TASK-031, TASK-035 | COMPLETE |
| TASK-037 | [[TASK-037 Invoice Versions]] | TASK-036, TASK-012 | COMPLETE |
| TASK-038 | [[TASK-038 Invoice Cancellation]] | TASK-036, TASK-012 | COMPLETE |
| TASK-039 | [[TASK-039 PDF Generation]] | TASK-036, TASK-010, TASK-033, TASK-034 | COMPLETE |
| TASK-040 | [[TASK-040 PDF Preview and Download]] | TASK-039 | COMPLETE |
| TASK-041 | [[TASK-041 Email Delivery]] | TASK-039, TASK-013 | COMPLETE |
| TASK-042 | [[TASK-042 Email Invoice UI]] | TASK-041 | COMPLETE |
| TASK-043 | [[TASK-043 Invoice Duplicate and Print]] | TASK-031, TASK-039 | COMPLETE |

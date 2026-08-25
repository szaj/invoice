---
type: task
status: complete
phase: 3
tags:
  - task
---

# Phase 03 — Customers

Customer master records. Financial summary widgets must not mix currencies.

Tasks: TASK-022 through TASK-029

Individual task files are the executable backlog. This note is the phase index.

Control: [[03 Implementation Plan]] · [[04 Implementation Status]] · [[01 Master Spec]]

| ID | Task | Dependencies | Status |
|---|---|---|---|
| TASK-022 | [[TASK-022 Customer Domain Schema]] | TASK-007, TASK-002 | COMPLETE |
| TASK-023 | [[TASK-023 Customer CRUD Service]] | TASK-022, TASK-009, TASK-005 | COMPLETE |
| TASK-024 | [[TASK-024 Customer List and Form UI]] | TASK-023 | COMPLETE |
| TASK-025 | [[TASK-025 Customer Company Relationships]] | TASK-023, TASK-008 | COMPLETE |
| TASK-026 | [[TASK-026 Customer Profile]] | TASK-024, TASK-025 | COMPLETE |
| TASK-027 | [[TASK-027 Customer Notes]] | TASK-023 | COMPLETE |
| TASK-028 | [[TASK-028 Customer Duplicate Detection and Status]] | TASK-023 | COMPLETE |
| TASK-029 | [[TASK-029 Customer Financial Summary]] | TASK-026 | COMPLETE |

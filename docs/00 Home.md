---
type: home
status: approved
aliases:
  - Home
  - Dashboard
tags:
  - product
---

# Multi-Brand Invoice SaaS

Internal development vault. Prefer **current-state** notes for Cursor and day-to-day work. Historical material lives under Archive (Git/Obsidian only — not normal Cursor context).

## Current state (authoritative)

- [[01 Current Architecture]]
- [[02 Current Product Rules]]
- [[03 Current Implementation Status]]
- [[04 Current Plan]]
- [[05 Architecture Decisions]]
- [[06 Development Log]] — recent entries only; full history: [[06 Development Log Archive]]

## Active work

- Tasks: `docs/Active/Tasks/` — next: [[TASK-083 Company Performance]]
- Modules: `docs/Active/Modules/`
- Unresolved: [[Unresolved Source Items]]
- UI system: [[UI UX Design System]]
- Completion workflow: [[Vault Completion Workflow]]

## Archive (history — not for normal Cursor TASK execution)

- Completed tasks: `docs/Archive/Completed Tasks/`
- Development logs: `docs/Archive/Development Logs/`
- Historical specs: `docs/Archive/Historical Specs/`

## Current development

Current Phase: Phase 08 — Reporting

Current Task: [[TASK-083 Company Performance]] (NOT STARTED)

Current Status: [[TASK-082 Customer Report]] COMPLETE. TASK-056/057 **DEFERRED**. Next buildable: [[TASK-083 Company Performance]]. ADR-009 / ADR-010 / ADR-011 remain OPEN. US-015 overpayment *allow* remains OPEN (default reject only).

Do not start TASK-083 until ready.

## Blocked Items

None blocking TASK-083. Bank processor live integration **DEFERRED** (US-017 / TASK-056–057).

## Critical Rules

- Company isolation server-side — [[02 Current Product Rules]], [[01 Current Architecture]]
- Confirmed financial records immutable — adjustments only
- Admin fixed conversion rates; snapshot locked on success
- Merchant fees never change balance / rate / settlement
- Refunds / disputes / chargebacks = linked adjustments

## Visual Map

- [[Architecture]] — canvas (may reference historical note names)

# Cursor Prompt — Build the Obsidian Development Vault

You are acting as the Lead Software Architect and Technical Documentation Engineer for a large Multi-Brand Invoice Management SaaS.

The repository already contains development Markdown files covering the product, architecture, modules, technical requirements, business rules, security, testing, deployment, and related topics.

Your task in this step is **ONLY to create and organize the Obsidian development vault**.

Do **not** build application functionality yet.

Do **not** generate frontend pages, backend APIs, database migrations, authentication, payment integrations, or any other application code.

The goal is to turn the existing Markdown documentation into a structured development control system that will later be used by Cursor to plan and build the SaaS safely, one task at a time.

---

# 1. Primary Objective

Create an Obsidian-compatible development vault inside:

```text
/docs
```

The `/docs` directory itself should be usable directly as an Obsidian vault.

Create:

```text
/docs/.obsidian/
```

Do not require a separate copy of the documentation outside the repository.

The same Markdown files must be usable by:

- Obsidian
- Cursor
- Git
- developers
- QA
- technical reviewers

The repository should therefore have one source of truth for development documentation.

---

# 2. Existing Documentation

Before creating or modifying anything:

1. Inspect all existing `.md` files in the repository.
2. Identify the purpose of each document.
3. Preserve all valid development requirements.
4. Do not silently delete requirements.
5. Do not invent requirements that are not present in the source documentation.
6. Do not rewrite financial, permission, payment, security, or compliance rules in a way that changes their meaning.
7. If two source files conflict, record the conflict instead of guessing which one is correct.

The existing specification is authoritative.

This task is primarily **organization, linking, metadata, navigation, planning structure, and development control**.

---

# 3. Target Vault Structure

Create or reorganize the vault into the following structure.

```text
docs/
│
├── .obsidian/
│
├── 00 Home.md
├── 01 Master Spec.md
├── 02 Architecture.md
├── 03 Implementation Plan.md
├── 04 Implementation Status.md
├── 05 Architecture Decisions.md
├── 06 Development Log.md
│
├── Product/
│   ├── Product Overview.md
│   ├── Product Goals.md
│   └── Definitions.md
│
├── Foundation/
│   ├── Roles and Permissions.md
│   ├── Companies and Brands.md
│   ├── Currency and Conversion.md
│   ├── Data Model.md
│   └── Business Rules.md
│
├── Modules/
│   ├── Customers.md
│   ├── Invoices.md
│   ├── PDF and Email.md
│   ├── Payments.md
│   ├── Refunds Disputes Chargebacks.md
│   ├── Compliance.md
│   ├── Audit Logs.md
│   ├── Dashboard and Reporting.md
│   ├── Notifications.md
│   └── Settings.md
│
├── Technical/
│   ├── API and Integrations.md
│   ├── Security.md
│   ├── Error Handling.md
│   ├── Testing.md
│   └── Deployment.md
│
├── Tasks/
│   ├── Phase 01 Foundation.md
│   ├── Phase 02 Financial Foundation.md
│   ├── Phase 03 Customers.md
│   ├── Phase 04 Invoicing.md
│   ├── Phase 05 Payments.md
│   ├── Phase 06 Payment Adjustments.md
│   ├── Phase 07 Compliance and Audit.md
│   ├── Phase 08 Reporting.md
│   └── Phase 09 Hardening and Deployment.md
│
└── Templates/
    ├── Development Task.md
    ├── Architecture Decision.md
    └── Development Log Entry.md
```

You may slightly adjust filenames only if an existing authoritative file already uses a better equivalent name.

Do not create duplicate documents representing the same source of truth.

---

# 4. File Migration Rules

The repository may already contain files such as:

```text
API and Integrations.md
Architecture.canvas
Audit Logs.md
Business Rules.md
Companies and Brands.md
Compliance.md
Currency and Conversion.md
Customers.md
Dashboard and Reporting.md
Data Model.md
Definitions.md
Deployment.md
Error Handling.md
Home.md
Invoices.md
Notifications.md
Out of Scope.md
Payments.md
PDF and Email.md
Product Goals.md
Product Overview.md
Refunds Disputes Chargebacks.md
Roles and Permissions.md
Screen Inventory.md
Security.md
Settings.md
Testing.md
```

Move or reorganize them into the new structure instead of unnecessarily recreating their contents.

Preserve the existing material.

If files contain overlapping sections:

- keep the most appropriate file as the authoritative location
- add links from related files
- avoid copying the same full requirement into many files

Do not retain a giant duplicated development specification if all of its useful development content has already been separated into authoritative module files.

If the original large Markdown file is useful as a historical source, move it to:

```text
/docs/Source/
```

and clearly mark it as a source/reference document rather than an active implementation control document.

---

# 5. Obsidian Frontmatter Standard

Add YAML frontmatter to the main vault documents where appropriate.

Use a consistent format similar to:

```yaml
---
type: module
status: approved
phase: 4
domain: invoicing
tags:
  - module
  - financial
---
```

Use only meaningful metadata.

Recommended `type` values:

```text
home
master-spec
architecture
module
foundation
technical
task
decision
status
log
template
reference
```

Recommended `status` values:

```text
draft
approved
not-started
planned
in-progress
blocked
complete
deprecated
```

Do not over-tag the vault.

Useful tags may include:

```text
#module
#architecture
#task
#decision
#financial
#security
#compliance
#integration
#reporting
#blocked
```

---

# 6. Create `00 Home.md`

This must become the primary Obsidian dashboard.

It should contain:

```markdown
# Multi-Brand Invoice SaaS

## Project Control

- [[01 Master Spec]]
- [[02 Architecture]]
- [[03 Implementation Plan]]
- [[04 Implementation Status]]
- [[05 Architecture Decisions]]
- [[06 Development Log]]

## Product

- [[Product Overview]]
- [[Product Goals]]
- [[Definitions]]

## Foundation

- [[Roles and Permissions]]
- [[Companies and Brands]]
- [[Currency and Conversion]]
- [[Data Model]]
- [[Business Rules]]

## Core Modules

- [[Customers]]
- [[Invoices]]
- [[PDF and Email]]
- [[Payments]]
- [[Refunds Disputes Chargebacks]]
- [[Compliance]]
- [[Audit Logs]]
- [[Dashboard and Reporting]]
- [[Notifications]]
- [[Settings]]

## Technical

- [[API and Integrations]]
- [[Security]]
- [[Error Handling]]
- [[Testing]]
- [[Deployment]]

## Development Phases

- [[Phase 01 Foundation]]
- [[Phase 02 Financial Foundation]]
- [[Phase 03 Customers]]
- [[Phase 04 Invoicing]]
- [[Phase 05 Payments]]
- [[Phase 06 Payment Adjustments]]
- [[Phase 07 Compliance and Audit]]
- [[Phase 08 Reporting]]
- [[Phase 09 Hardening and Deployment]]

## Current Development

Current Phase:

Current Task:

Current Status:

Next Task:

## Blocked Items

None currently recorded.
```

Do not put the entire product specification inside `00 Home.md`.

It is a control dashboard, not a requirements dump.

---

# 7. Create `01 Master Spec.md`

This file is the documentation router.

It must tell Cursor and developers where authoritative requirements live.

Example structure:

```markdown
# Master Development Specification

This file defines the authoritative location of development requirements.

## Product

Product overview:
[[Product Overview]]

Product goals:
[[Product Goals]]

Definitions:
[[Definitions]]

## Architecture

System architecture:
[[02 Architecture]]

Database:
[[Data Model]]

API:
[[API and Integrations]]

## Security and Authorization

Roles:
[[Roles and Permissions]]

Security:
[[Security]]

Business rules:
[[Business Rules]]

## Companies

[[Companies and Brands]]

## Currency

[[Currency and Conversion]]

## Customers

[[Customers]]

## Invoicing

[[Invoices]]

PDF and email:
[[PDF and Email]]

## Payments

[[Payments]]

Adjustments:
[[Refunds Disputes Chargebacks]]

## Governance

[[Compliance]]

[[Audit Logs]]

## Reporting

[[Dashboard and Reporting]]

## System Services

[[Notifications]]

[[Settings]]

## Operations

[[Error Handling]]

[[Testing]]

[[Deployment]]
```

At the top add a rule:

> When implementing a feature, the module-specific document and all linked foundation/technical documents are authoritative. Do not infer missing requirements from unrelated modules.

---

# 8. Create `02 Architecture.md`

Do not invent final architecture decisions unless they are already established in the source documentation.

This file should contain:

- architecture overview
- application layers
- domain boundaries
- data flow
- tenant/company isolation model
- authentication and authorization boundaries
- financial domain boundaries
- payment provider abstraction
- background processing boundaries
- object storage
- transactional email
- audit architecture
- reporting architecture
- integration boundaries
- deployment overview

Where a final implementation choice is not yet approved, use:

```text
Decision Status: OPEN
```

and link it to:

```text
[[05 Architecture Decisions]]
```

Do not force framework choices purely because they are common.

---

# 9. Create `03 Implementation Plan.md`

This is the development roadmap.

Do not implement code.

Break the SaaS into dependency-aware phases.

Use this build order unless the source documentation establishes a stronger dependency:

```text
Phase 01 — Platform Foundation

Project setup
Authentication
Users
Roles
Permissions
User/company assignments
Company model
Reporting groups
Audit foundation
Core settings

Phase 02 — Financial Foundation

Currencies
Company currencies
Fixed conversion rates
Rate versioning
Effective dates
Money utilities
Rounding rules

Phase 03 — Customers

Customer CRUD
Customer/company relationships
Customer profile
Customer notes
Customer financial summary

Phase 04 — Invoicing

Invoice CRUD
Invoice items
Invoice numbering
Invoice lifecycle
Invoice versions
PDF generation
Email delivery

Phase 05 — Payments

Payment domain
Manual payments
Payment provider abstraction
Stripe
PayPal
Bank/card processor adapter
Webhooks
Partial payments
Payment allocation
Settlement conversion

Phase 06 — Payment Adjustments

Disputes
Refunds
Partial refunds
Chargeback debit/loss
Chargeback won/reversal
Adjustment history
CB/RF calculations

Phase 07 — Compliance and Audit

Compliance queues
Compliance review
Compliance notes
Audit viewer
Operational notifications

Phase 08 — Reporting

Dashboard
Invoice reports
Payment reports
Outstanding
Overdue aging
Customer reports
Company performance
Staff performance
Gateway reports
Currency reports
Monthly brand matrix
Reporting group rollups
CB/RF reporting
Exports

Phase 09 — Hardening and Deployment

Authorization testing
Financial calculation testing
Webhook testing
E2E
Performance
Queues
Monitoring
Backup
Recovery
Production deployment
```

Every phase must later be broken into small task IDs.

Do not create tasks so broad that Cursor would need to build an entire major module in one implementation session.

---

# 10. Task ID Standard

Use IDs such as:

```text
TASK-001
TASK-002
TASK-003
```

Each task must include:

```markdown
## TASK-XXX — Task Name

Status: NOT STARTED

Phase:

Dependencies:

Source Documents:

Objective:

Scope:

Database Changes:

Backend:

Frontend:

Authorization:

Business Rules:

Tests:

Definition of Done:
```

A task should represent a small, reviewable implementation unit.

Examples:

```text
TASK-001 Repository and Application Foundation
TASK-002 Authentication Base
TASK-003 Roles and Permissions Model
TASK-004 User Company Assignments
TASK-005 Company CRUD
TASK-006 Company Context and Switcher
TASK-007 Reporting Groups
TASK-008 Audit Event Foundation
TASK-009 Currency Master
TASK-010 Company Currency Configuration
TASK-011 Fixed Rate Schema
TASK-012 Fixed Rate Versioning
TASK-013 Effective Rate Selection
```

Continue this pattern for the entire system.

---

# 11. Create `04 Implementation Status.md`

This is the central development memory.

Create status tables organized by phase.

Example:

```markdown
# Implementation Status

## Status Values

- NOT STARTED
- PLANNED
- IN PROGRESS
- BLOCKED
- COMPLETE

## Phase 01 — Foundation

| Task | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| TASK-001 Repository Foundation | NOT STARTED | | | | |
| TASK-002 Authentication | NOT STARTED | | | | |
| TASK-003 RBAC | NOT STARTED | | | | |
```

Include every task from the implementation plan.

Do not mark anything complete merely because documentation exists.

Application implementation status and documentation status are different.

---

# 12. Create `05 Architecture Decisions.md`

Use an ADR-style format.

Start with an index:

```markdown
# Architecture Decisions

| ID | Decision | Status |
|---|---|---|
| ADR-001 | Application framework | OPEN |
| ADR-002 | Database | OPEN |
| ADR-003 | Authentication | OPEN |
| ADR-004 | Money representation | OPEN |
| ADR-005 | Background jobs | OPEN |
| ADR-006 | Object storage | OPEN |
| ADR-007 | Transactional email | OPEN |
| ADR-008 | Payment provider architecture | OPEN |
```

For each decision use:

```markdown
## ADR-XXX — Decision Name

Status: OPEN

### Context

### Decision

### Reason

### Alternatives Considered

### Consequences

### Related Documents
```

Only mark a decision `ACCEPTED` when it is already supported by project requirements or explicitly approved.

---

# 13. Create `06 Development Log.md`

This is chronological implementation history.

Start with:

```markdown
# Development Log

## Log Format

### YYYY-MM-DD — TASK-XXX

Work completed:

Files changed:

Database changes:

Tests:

Decisions:

Problems:

Next task:
```

Do not fabricate development history.

Leave it ready for future entries.

---

# 14. Module Linking Standard

Every module document should have a small relationship section.

Example for `Invoices.md`:

```markdown
## Related Documentation

### Depends On

- [[Companies and Brands]]
- [[Customers]]
- [[Currency and Conversion]]
- [[Roles and Permissions]]
- [[Business Rules]]

### Integrates With

- [[PDF and Email]]
- [[Payments]]
- [[Compliance]]
- [[Audit Logs]]
- [[Dashboard and Reporting]]

### Technical

- [[Data Model]]
- [[API and Integrations]]
- [[Security]]
- [[Testing]]
```

Example for `Payments.md`:

```markdown
## Related Documentation

### Depends On

- [[Invoices]]
- [[Currency and Conversion]]
- [[Companies and Brands]]
- [[Roles and Permissions]]

### Integrates With

- [[Refunds Disputes Chargebacks]]
- [[Audit Logs]]
- [[Dashboard and Reporting]]
- [[Compliance]]

### Technical

- [[API and Integrations]]
- [[Business Rules]]
- [[Security]]
- [[Testing]]
```

Add similar relationship links where appropriate.

Do not create meaningless backlinks merely to make the graph denser.

---

# 15. Critical Cross-Module Rules

Ensure these requirements are clearly linked across the vault wherever relevant.

## Company Isolation

Every company-scoped operation must enforce company access server-side.

Frontend hiding is not authorization.

Link this rule between:

```text
Roles and Permissions
Companies and Brands
Business Rules
Security
Data Model
API and Integrations
Testing
```

## Financial Immutability

Confirmed financial transactions must preserve historical values.

Corrections must use adjustment/reversal workflows rather than silently editing historical records.

Link this between:

```text
Invoices
Payments
Refunds Disputes Chargebacks
Currency and Conversion
Business Rules
Audit Logs
Testing
```

## Fixed Conversion Rates

Rates are Admin-defined and versioned.

Historical payments retain the exact rate snapshot used.

Changing a rate affects future transactions only.

Link this between:

```text
Currency and Conversion
Payments
Business Rules
Data Model
Dashboard and Reporting
Testing
```

## Merchant Fees

Merchant/processor fees are reconciliation data only.

They must never change:

```text
invoice balance
fixed conversion rate
converted settlement amount
invoice amount
```

Link this rule between:

```text
Payments
Currency and Conversion
Dashboard and Reporting
Business Rules
Testing
```

## Payment Adjustments

Refunds, disputes, and chargebacks create linked adjustment records.

The original successful payment remains preserved.

Link this between:

```text
Payments
Refunds Disputes Chargebacks
Audit Logs
Dashboard and Reporting
Business Rules
Testing
```

---

# 16. Development Task Template

Create:

```text
/Templates/Development Task.md
```

with:

```markdown
---
type: task
status: not-started
phase:
module:
depends_on:
tags:
  - task
---

# TASK-XXX — Task Name

## Objective

## Source Documents

- [[]]

## Dependencies

## Scope

### Included

### Excluded

## Database Changes

## Backend

## Frontend

## Authorization

## Business Rules

## Error Handling

## Tests

### Unit

### Integration

### Authorization

### E2E

## Definition of Done

- [ ] Required schema changes completed
- [ ] Backend/domain implementation completed
- [ ] UI completed where applicable
- [ ] Server-side authorization enforced
- [ ] Business rules enforced
- [ ] Tests added
- [ ] Relevant tests passing
- [ ] Documentation updated
- [ ] Implementation Status updated
- [ ] Architecture Decisions updated if required

## Cursor Implementation Result

### Files Created

### Files Modified

### Migrations

### APIs

### Tests

### Issues

### Commit

## Next Recommended Task
```

---

# 17. Architecture Decision Template

Create:

```text
/Templates/Architecture Decision.md
```

with:

```markdown
---
type: decision
status: open
tags:
  - architecture
  - decision
---

# ADR-XXX — Decision Name

## Status

OPEN

## Context

## Decision

## Reason

## Alternatives Considered

## Consequences

## Related Documents

- [[]]

## Date
```

---

# 18. Development Log Template

Create:

```text
/Templates/Development Log Entry.md
```

with:

```markdown
# YYYY-MM-DD — TASK-XXX

## Work Completed

## Files Created

## Files Modified

## Database Changes

## API Changes

## Tests

## Decisions

## Issues

## Commit

## Next Task
```

---

# 19. Obsidian Configuration

Create a minimal `.obsidian` configuration suitable for a development vault.

Do not add unnecessary community plugins.

The vault should work using core Obsidian functionality.

Enable or configure where practical:

- backlinks
- outgoing links
- graph
- templates
- file explorer
- search

Set the templates folder to:

```text
Templates
```

Do not depend on Dataview, Tasks, Kanban, or other community plugins at this stage.

The vault must remain portable and understandable as plain Markdown.

---

# 20. Graph-Friendly Structure

Use Obsidian wikilinks:

```text
[[Payments]]
[[Invoices]]
[[Currency and Conversion]]
```

instead of hardcoded absolute filesystem paths inside the documentation where practical.

The graph should naturally show:

```text
Companies
   ↓
Customers
   ↓
Invoices
   ↓
Payments
   ↓
Adjustments

Currency ─────────→ Payments

Roles ────────────→ all company-scoped modules

Payments ─────────→ Reporting

Adjustments ──────→ CB/RF Reporting

Compliance ───────→ Customers / Invoices / Payments

Audit Logs ───────→ all privileged actions
```

Do not distort requirements purely to make a visually attractive graph.

---

# 21. Screen Inventory

If `Screen Inventory.md` exists, retain it.

Place it in the most logical location, such as:

```text
/docs/Product/Screen Inventory.md
```

or:

```text
/docs/Technical/Screen Inventory.md
```

depending on its contents.

Link screens back to their corresponding module documents.

Do not duplicate all screen definitions into every module.

---

# 22. Out-of-Scope Material

If an `Out of Scope.md` file already exists and contains valid Version 1 boundaries, preserve it as a reference.

Recommended location:

```text
/docs/Product/Out of Scope.md
```

Do not convert future ideas into implementation tasks.

Anything explicitly defined as out of scope must not appear as an active implementation task.

---

# 23. Do Not Create Application Code

This instruction is critical.

During this task, do not create or modify:

```text
src/
app/
pages/
api/
prisma/
database migrations
payment integrations
authentication code
UI components
server actions
controllers
services
repositories
tests for application functionality
deployment pipelines
```

unless a tiny repository-only change is absolutely required to make `/docs` function as the requested Obsidian vault.

This stage is documentation architecture only.

---

# 24. Validation Pass

Before finishing, verify:

- every original development document still exists or has been intentionally moved
- no major requirement was lost during restructuring
- there are no unnecessary duplicate source-of-truth documents
- all major module documents are linked from `01 Master Spec.md`
- all development phases are represented in `03 Implementation Plan.md`
- every implementation task appears in `04 Implementation Status.md`
- architecture decisions have unique ADR IDs
- task IDs are unique
- wikilinks point to valid documents
- `/docs` opens cleanly as an Obsidian vault
- the vault works without community plugins
- no application implementation has started

---

# 25. Final Deliverables

At the end of this task, the repository should contain a fully organized Obsidian development vault with:

1. Home dashboard
2. Master specification router
3. Architecture document
4. Dependency-aware implementation plan
5. Implementation status tracker
6. Architecture decision register
7. Development log
8. Structured Product folder
9. Structured Foundation folder
10. Structured Modules folder
11. Structured Technical folder
12. Phase/task documents
13. Development task template
14. ADR template
15. Development log template
16. Cross-linked module documentation
17. Minimal Obsidian configuration
18. Preserved source requirements
19. No application code implementation

---

# 26. Completion Response

When complete, do not begin building the SaaS.

Return only a concise report containing:

```text
Vault created:
Files created:
Files moved:
Files updated:
Documents preserved:
Conflicts found:
Open architecture decisions:
Number of implementation phases:
Number of development tasks:
Broken links:
Next recommended action:
```

The next recommended action should be to review the generated vault and implementation plan before beginning `TASK-001`.

Stop after the vault setup is complete.

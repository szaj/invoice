---
type: product-rules
status: approved
tags:
  - product
  - finance
---

# Current Product Rules

Business rules future tasks must still obey. Implementation history is not recorded here. Detailed historical wording: [[Business Rules]] (archived).

## Company and access

- Every company-scoped operation enforces company access **server-side** (BR-016).
- Admin: all companies. Compliance/Staff: assigned companies only.
- Reporting groups do not grant access.
- Customer portal is out of scope for Version 1 (BR-014).

## Invoices

- Every invoice belongs to exactly one company and one customer (BR-001).
- Invoice currency must be active globally and enabled for the company (BR-002).
- Invoice numbers unique within a company; never reused (BR-003).
- Overdue only for issued/sent/partial with balance > 0 and past due date (BR-018).
- Cancelled invoices excluded from collectible outstanding unless policy says otherwise (BR-019).
- Emailing an invoice requires a valid customer email (BR-017).
- Issued financial edit policy and discount model remain **OPEN** (ADR-009, ADR-010) — do not invent.

## Payments and money

- Paid/confirmed payments must not be hard-deleted (BR-004).
- Confirmed payment financial fields are locked; corrections use adjustments (BR-005, BR-023).
- Settlement currency must be enabled for the gateway/company (BR-006). Initial settlement currencies: USD, AED (BR-007).
- Processor credentials only for backend + authorized Admin config (BR-008).
- Outstanding is computed from confirmed payment applications, not manually edited paid totals (BR-009).
- A payment cannot apply more than open balance unless overpayment is explicitly supported and authorized (BR-010). **Default: reject.** Allow-workflow remains OPEN (US-015).
- Disabled currencies/gateways stay visible on historical records (BR-011).
- Soft-delete/status for financial records with dependencies (BR-012).
- Mixed-currency totals must not display as one unlabeled amount (BR-013).
- Fixed conversion rate snapshot for successful payments is permanent; fees never affect rate, converted settlement, or invoice balance (BR-020).
- Changing a fixed rate never recalculates prior payments (BR-021).
- Rate versions selected by effective date/time for future transactions (BR-022).

## Refunds, disputes, chargebacks

- Refund/dispute/chargeback actions create linked adjustment records; original SUCCESSFUL payment stays immutable (BR-023).
- **CB/RF** = processed refunds + chargeback debits/losses − won/reversed chargebacks. An open dispute alone has **no** financial deduction (BR-024).
- Refund/chargeback conversion uses original payment rate snapshot, or actual merchant debit/refund in settlement currency when known — never “today’s” rate (BR-025).
- Cumulative financial deductions must not exceed the original payment unless an authorized correction workflow explicitly allows it.
- Net G.Total = Gross Receipts − CB/RF for the selected period/reporting currency (BR-026).

## Audit and permissions

- Every privileged financial/status/settings action generates an audit event (BR-015).
- Staff optional grants (manual payment, report export, audit visibility, etc.) remain default **denied** until explicitly configured (US-007–010).

## Version 1 out of scope (do not implement)

Customer portal/dashboard, GL/double-entry, expenses, inventory, payroll, POs, tax filing, automated debt collection beyond email reminders, native mobile apps, live/automatic FX providers.

See [[Out of Scope]] (archived product note) and [[04 Current Plan]].
Do not invent Version 1 exclusions away from those lists.

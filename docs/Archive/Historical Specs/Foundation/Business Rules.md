---
type: foundation
status: approved
tags:
  - product
  - finance
---

# Business Rules

> [!abstract] Related
> [[Invoices]] · [[Payments]] · [[Currency and Conversion]] · [[Refunds Disputes Chargebacks]] · [[Security]] · [[00 Home]]

| Rule | Requirement |
| --- | --- |
| BR-001 | Every invoice belongs to exactly one company and one customer. |
| BR-002 | Invoice currency must be active globally and enabled for the selected company. |
| BR-003 | Invoice numbers must be unique within a company and must not be reused. |
| BR-004 | Paid/confirmed payments must not be hard-deleted. |
| BR-005 | Confirmed payment financial fields are locked; corrections use adjustments/reversals. |
| BR-006 | A settlement currency must be enabled for the selected payment gateway/company. |
| BR-007 | USD and AED are the initial settlement currencies. |
| BR-008 | Processor credentials are available only to backend services and authorized Admin configuration interfaces. |
| BR-009 | Invoice outstanding is computed from confirmed payment applications, not from manually edited paid totals. |
| BR-010 | A payment cannot apply more than the open invoice balance unless overpayment is explicitly supported and authorized. |
| BR-011 | Disabled currencies/gateways remain visible on historical records. |
| BR-012 | Financial records with dependencies use soft-delete/status changes, not physical deletion. |
| BR-013 | Mixed-currency totals must not be displayed as a single amount unless converted to a labeled reporting currency. |
| BR-014 | Customer portal functionality is not provided in Version 1. |
| BR-015 | Every privileged financial/status/settings action must generate an audit event. |
| BR-016 | Backend permission checks are mandatory for every company-scoped request. |
| BR-017 | Emailing an invoice requires a valid customer email address. |
| BR-018 | Overdue status applies only to issued/sent/partial invoices with balance > 0 and due date in the past. |
| BR-019 | Cancelled invoices are excluded from collectible outstanding totals unless business policy specifies otherwise. |
| BR-020 | The Admin-defined fixed conversion rate snapshot used for a successful payment must be permanently stored. Merchant fees must never affect that rate, converted settlement amount, or invoice balance. |
| BR-021 | Changing a fixed conversion rate never recalculates/overwrites a prior payment. Each payment stores rate_version_id and fixed_rate_snapshot. |
| BR-022 | Rates may be updated monthly, yearly, manually, or scheduled. Effective date/time determines which future transactions use the version. |
| BR-023 | Refund/dispute/chargeback actions create linked adjustment records; the original successful payment remains immutable. |
| BR-024 | CB/RF includes processed refunds and chargeback debits/losses, net of won/reversed chargebacks. An open dispute alone has no financial deduction. |
| BR-025 | Historical refund/chargeback conversion uses the original payment rate snapshot when needed, or the actual merchant debit/refund amount in settlement currency when known. |
| BR-026 | Net G.Total = Gross Receipts - CB/RF for the selected period/reporting currency. |


## Related Documentation

### Depends On

- [[Roles and Permissions]]
- [[Companies and Brands]]

### Integrates With

- [[Invoices]]
- [[Payments]]
- [[Currency and Conversion]]
- [[Refunds Disputes Chargebacks]]

### Technical

- [[Security]]
- [[Testing]]
- [[Audit Logs]]

> [!warning] Company isolation
> Every company-scoped operation must enforce company access **server-side**. Frontend hiding is not authorization.
> Also see [[Roles and Permissions]] · [[Companies and Brands]] · [[Business Rules]] · [[Security]] · [[Data Model]] · [[API and Integrations]] · [[Testing]]

> [!danger] Financial immutability
> Confirmed financial transactions must preserve historical values. Corrections use adjustment/reversal workflows rather than silently editing historical records.
> Also see [[Invoices]] · [[Payments]] · [[Refunds Disputes Chargebacks]] · [[Currency and Conversion]] · [[Business Rules]] · [[Audit Logs]] · [[Testing]]

> [!danger] Fixed conversion rates
> Rates are Admin-defined and versioned. Historical payments retain the exact rate snapshot used. Changing a rate affects future transactions only. Never fetch, guess, or substitute a market/gateway rate.
> Also see [[Currency and Conversion]] · [[Payments]] · [[Business Rules]] · [[Data Model]] · [[Dashboard and Reporting]] · [[Testing]]

> [!tip] Merchant fees
> Merchant/processor fees are reconciliation data only. They must never change invoice balance, the fixed conversion rate, converted settlement amount, or invoice amount.
> Also see [[Payments]] · [[Currency and Conversion]] · [[Dashboard and Reporting]] · [[Business Rules]] · [[Testing]]

> [!warning] Payment adjustments
> Refunds, disputes, and chargebacks create linked adjustment records. The original successful payment remains preserved.
> Also see [[Payments]] · [[Refunds Disputes Chargebacks]] · [[Audit Logs]] · [[Dashboard and Reporting]] · [[Business Rules]] · [[Testing]]

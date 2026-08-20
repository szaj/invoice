---
type: technical
status: approved
tags:
  - qa
  - technical
---

# Testing

> [!important] Accepted test stack
> Unit/integration: **Vitest**. E2E: **Playwright**. See [[05 Architecture Decisions#ADR-016 — Testing|ADR-016]]. High-risk coverage in this note remains required.

> [!abstract] Related
> [[Business Rules]] · [[Payments]] · [[Currency and Conversion]] · [[Invoices]] · [[Dashboard and Reporting]] · [[00 Home]]

### 22.1 Required Test Layers

- Unit tests for money calculations, status logic, permission rules, fixed-rate currency conversion, invoice numbering. TASK-019 covers Decimal conversion formula, same-currency 1, fee exclusion, and rounding in `tests/unit/money.test.ts`.

- Integration tests for database transactions and payment/provider adapters.

- Webhook tests for signature validation, idempotency, retries, and out-of-order events.

- API authorization tests for cross-company data leakage.

- PDF snapshot/visual QA for representative invoice layouts.

- Email tests using sandbox/test provider.

- End-to-end tests for major business workflows.

- Regression tests for reports and exports.

### 22.2 Critical End-to-End Scenarios

| ID | Scenario |
| --- | --- |
| E2E-01 | Admin creates company, enables GBP invoices and USD settlement, configures Stripe, creates staff access. |
| E2E-02 | Staff creates customer, creates GBP invoice, generates PDF, emails invoice. |
| E2E-03 | GBP invoice is partially paid through USD Stripe; payment uses the configured fixed GBP->USD rate, stores the rate snapshot and converted settlement amount, and invoice becomes Partially Paid. Any merchant fee captured is separate and does not alter conversion. |
| E2E-04 | Second payment completes balance; invoice becomes Paid. |
| E2E-05 | AUD invoice is paid manually into AED bank processor; the configured fixed AUD->AED rate is applied, stored, and locked. |
| E2E-06 | Compliance reviews payment/invoice, adds note, approves; events appear in audit log. |
| E2E-07 | Staff attempts to access unassigned company data and is denied. |
| E2E-08 | Admin disables PayPal for one company; it disappears from new invoice payment options but old PayPal payments remain. |
| E2E-09 | Admin adds new currency; enables it for one company; other companies cannot use it until enabled. |
| E2E-10 | Duplicate webhook is sent twice; only one confirmed payment is created. |
| E2E-11 | Report shows separate original currencies and correct USD reporting equivalent using stored fixed-rate snapshots. |
| E2E-12 | Issued invoice cancellation requires reason and preserves PDF/audit history. |
| E2E-13 | Admin sets USD->AED 3.67 effective 01-Jan and later 3.68 effective 01-Jul. January payment remains 3.67; July payment uses 3.68; no historical recalculation occurs. |
| E2E-14 | Authorized user opens a dispute on a successful payment. Payment shows Disputed/Under Review but gross payment and CB/RF remain unchanged until a financial adjustment is recorded. |
| E2E-15 | Authorized user records full/partial refund. Linked adjustment is created, original payment is preserved, and CB/RF reflects the processed amount. |
| E2E-16 | Chargeback debit is recorded in CB/RF; later chargeback won/reversal creates a reversing adjustment and restores net impact without editing original records. |
| E2E-17 | Yearly VX reporting-group report shows month rows, brand columns, Monthly Total, CB/RF, G.Total, and annual summary, with drill-down to transactions. |


## Related Documentation

### Depends On

- [[Business Rules]]

### Integrates With

- [[Payments]]
- [[Currency and Conversion]]
- [[Invoices]]
- [[Dashboard and Reporting]]

### Technical

- [[Security]]
- [[API and Integrations]]

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

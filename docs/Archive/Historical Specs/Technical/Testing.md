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

- Unit tests for money calculations, status logic, permission rules, fixed-rate currency conversion, invoice numbering. TASK-019 covers Decimal conversion formula, same-currency 1, fee exclusion, and rounding in `tests/unit/money.test.ts`. TASK-021 covers new-selection rejection of disabled currencies and historical visibility labels in `tests/unit/currency-selection.test.ts`. TASK-022 covers customer master schema constraints in `tests/unit/customers-schema.test.ts`. TASK-023/025 cover customer CRUD and company-link authz in `tests/unit/customers-crud.test.ts` and live link/unlink in `tests/integration/customers-crud.test.ts`. TASK-026 covers profile payload and unassigned-company omission in `tests/unit/customers-profile.test.ts` and `tests/integration/customers-profile.test.ts`. TASK-027 covers internal notes create/list/authz and PDF/email omission fixture in `tests/unit/customers-notes.test.ts` and `tests/integration/customers-notes.test.ts`. TASK-028 covers duplicate match/ack gates and soft-status invoice gate in `tests/unit/customers-duplicates.test.ts` and `tests/integration/customers-duplicates.test.ts`. TASK-029 covers by-currency financial summary aggregation and BR-013 mixed-currency display in `tests/unit/customers-financial-summary.test.ts`. TASK-030 covers invoice header schema constraints (company+customer required) in `tests/unit/invoices-schema.test.ts`. TASK-031 covers draft create/update authz (Staff own/assigned), inactive customer and BR-002 currency gates in `tests/unit/invoices-draft.test.ts` and live draft CRUD in `tests/integration/invoices-draft.test.ts`. TASK-032 covers company-scoped draft list denial for unassigned companies in `tests/unit/invoices-draft.test.ts` (UI consumes TASK-031 services). TASK-033 covers line-total Decimal math and qty > 0 in `tests/unit/invoices-line-items.test.ts` and nested draft replace in `tests/integration/invoices-line-items.test.ts`. TASK-034 covers invoice totals with zero payments and BR-009 outstanding in `tests/unit/invoices-totals.test.ts` (persisted on line replace). TASK-035 covers number format/hand-edit rejection in `tests/unit/invoices-numbering.test.ts` and concurrent allocation uniqueness / company isolation in `tests/integration/invoices-numbering.test.ts`. TASK-036 covers allowed transitions and BR-018 overdue in `tests/unit/invoices-lifecycle.test.ts` and issue + overdue in `tests/integration/invoices-lifecycle.test.ts`. TASK-037 covers version snapshots and Staff financial PATCH denial in `tests/unit/invoices-versions.test.ts` and `tests/integration/invoices-versions.test.ts`. TASK-044 covers payment domain schema (fee separate from converted settlement, SUCCESSFUL immutability, provider-agnostic columns) in `tests/unit/payments-schema.test.ts` and `tests/integration/payments-schema.test.ts`. TASK-045 covers create pending / confirm / fail, lock after SUCCESSFUL, missing Admin rate, and Staff write denial in `tests/unit/payments-service.test.ts` and `tests/integration/payments-service.test.ts`. TASK-046 covers settlement conversion snapshot lock (`rate_effective_at` / `rate_version_id`), later-rate immutability, and confirm-stores-snapshot in `tests/unit/payments-snapshot.test.ts`, `tests/unit/payments-service.test.ts`, and `tests/integration/payments-snapshot.test.ts` (E2E-13 analogue; Playwright deferred until payment UI). TASK-047 covers optional processor fee / actual received as reconciliation only (fee change does not alter outstanding or converted settlement; actual received is not derived) in `tests/unit/payments-reconciliation.test.ts`, `tests/unit/money.test.ts`, and `tests/unit/payments-service.test.ts`. TASK-048 covers the PaymentProvider registry, capability flags, Manual + Fake adapters, normalized Pending/Successful/Failed mapping, and core-payment decoupling from vendor SDKs in `tests/unit/payments-provider.test.ts`. TASK-049 covers ADR-022 envelope encrypt/decrypt, tamper/AAD fail-closed, keyring fail-closed, safe API/audit metadata, Staff denial, company isolation, and non-secret PATCH credential preservation in `tests/unit/gateway-credentials.test.ts` and `tests/integration/gateway-configuration.test.ts`. TASK-050 covers manual record create→confirm SUCCESSFUL, Admin fixed-rate conversion, BR-010 open-balance reject, Staff denial (US-007), and invoice outstanding unchanged in `tests/unit/payments-manual.test.ts`, `tests/unit/payments-service.test.ts`, and `tests/integration/payments-manual.test.ts` (E2E-05 precursor). TASK-051 covers Manual Payment UI authz (`payment.manual.record`) in `tests/unit/payments-ui-authz.test.ts`; submit reuses TASK-050 (no duplicate domain tests); E2E UI N/A (shell smoke only). TASK-052 covers Stripe adapter registry resolution, credential fail-closed/isolation, Admin converted settlement minor units (no FX), idempotency, status mapping, and sandbox/live in `tests/unit/payments-stripe-adapter.test.ts` and `tests/integration/payments-stripe-adapter.test.ts` (fakes only; no live Stripe). TASK-053 covers Stripe webhook signature reject, `payment_events` idempotency (E2E-10), orphan IGNORED, and WEBHOOK audit in `tests/unit/payments-stripe-webhook.test.ts`, `tests/integration/payments-stripe-webhook.test.ts`, and public-path coverage in `tests/unit/auth-security.test.ts`. TASK-054 covers PayPal adapter registry resolution, credential fail-closed/isolation, Admin converted settlement decimal amount (no FX), idempotency, status mapping, sandbox/live hosts, and verifyWebhook in `tests/unit/payments-paypal-adapter.test.ts` and `tests/integration/payments-paypal-adapter.test.ts` (fakes only; no live PayPal). TASK-055 covers PayPal webhook signature reject, `payment_events` idempotency (E2E-10), orphan IGNORED, and WEBHOOK audit in `tests/unit/payments-paypal-webhook.test.ts`, `tests/integration/payments-paypal-webhook.test.ts`, and public-path coverage in `tests/unit/auth-security.test.ts`. TASK-063 covers dispute open without outstanding/CB/RF deduction, linked `payment_adjustments` row, and Staff `payment.adjust` denial in `tests/unit/payments-dispute.test.ts`, `tests/unit/money.test.ts`, and `tests/integration/payments-dispute.test.ts` (E2E-14 analogue; Playwright UI remains TASK-069).

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
| E2E-02 | Staff creates customer, creates GBP invoice, generates PDF, emails invoice. (PDF TASK-039/040; email send TASK-041; modal UI TASK-042 COMPLETE — live run still needs AUTH_TEST_*.) |
| E2E-03 | GBP invoice is partially paid through USD Stripe; payment uses the configured fixed GBP->USD rate, stores the rate snapshot and converted settlement amount, and invoice becomes Partially Paid. Any merchant fee captured is separate and does not alter conversion. (Covered by `tests/integration/payments-partial.test.ts` — manual partial with Admin rate + fee excluded + PARTIALLY_PAID.) |
| E2E-04 | Second payment completes balance; invoice becomes Paid. (Same integration test completes to PAID.) |
| E2E-05 | AUD invoice is paid manually into AED bank processor; the configured fixed AUD->AED rate is applied, stored, and locked. |
| E2E-06 | Compliance reviews payment/invoice, adds note, approves; events appear in audit log. |
| E2E-07 | Staff attempts to access unassigned company data and is denied. |
| E2E-08 | Admin disables PayPal for one company; it disappears from new invoice payment options but old PayPal payments remain. |
| E2E-09 | Admin adds new currency; enables it for one company; other companies cannot use it until enabled. |
| E2E-10 | Duplicate webhook is sent twice; only one confirmed payment is created. |
| E2E-11 | Report shows separate original currencies and correct USD reporting equivalent using stored fixed-rate snapshots. |
| E2E-12 | Issued invoice cancellation requires reason and preserves PDF/audit history. (Cancel + audit TASK-038; PDF store TASK-039; full E2E with download later.) |
| E2E-13 | Admin sets USD->AED 3.67 effective 01-Jan and later 3.68 effective 01-Jul. January payment remains 3.67; July payment uses 3.68; no historical recalculation occurs. (TASK-046 covers the snapshot lock in unit/integration; Playwright waits on payment UI.) |
| E2E-14 | Authorized user opens a dispute on a successful payment. Payment shows Disputed/Under Review but gross payment and CB/RF remain unchanged until a financial adjustment is recorded. (TASK-063: `tests/unit/payments-dispute.test.ts` + `tests/integration/payments-dispute.test.ts`; Playwright UI remains TASK-069.) |
| E2E-15 | Authorized user records full/partial refund. Linked adjustment is created, original payment is preserved, and CB/RF reflects the processed amount. (TASK-064 full refund: `tests/unit/payments-refund.test.ts` + `tests/integration/payments-refund.test.ts`; partial remains TASK-065; Playwright UI remains TASK-069.) |
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

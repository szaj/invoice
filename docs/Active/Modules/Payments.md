---
type: module
status: approved
phase: 5
domain: payments
tags:
  - module
  - finance
---

# Payments

> [!abstract] Related
> [[Invoices]] · [[Currency and Conversion]] · [[Refunds Disputes Chargebacks]] · [[API and Integrations]] · [[Error Handling]] · [[02 Current Product Rules]] · [[00 Home]]

> [!tip] Merchant fees
> Fees are optional reconciliation data. They never enter the conversion formula, never change converted settlement, and never change invoice balance.

```mermaid
sequenceDiagram
    participant Staff
    participant App
    participant Gateway
    Staff->>App: Send invoice + payment method
    App->>App: Snapshot active fixed rate
    App->>Gateway: Create checkout in settlement currency
    Gateway-->>App: Customer pays
    Gateway->>App: Signed webhook
    App->>App: Idempotent process + lock snapshot
    App->>App: Recalc invoice status + audit
```

### 10.1 Supported Payment Modes

| Mode | Initial Requirement |
| --- | --- |
| Stripe | Online/card processor integration. Company-specific credentials. Enable/disable per company. Settlement currency rules configurable. |
| PayPal | Company-specific integration. Enable/disable per company. Settlement currency rules configurable. |
| Bank/Card Processor | Provider **slot / configuration method code** (`BANK_PROCESSOR`) on company gateway config. Version 1 has **no live bank processor adapter**. Do not invent a fictional banking API. Exact vendor/API (Authorize.Net, Adyen, Checkout.com, Braintree, local acquirers, etc.) is selected later and added as an independent `PaymentProvider` adapter without redesigning the payment domain ([[TASK-056 Bank Processor Adapter]] / [[TASK-057 Bank Processor Webhook]] **DEFERRED**). |
| Manual Payment | Authorized user records payment received outside an automated gateway. |

### 10.2 Gateway Configuration Per Company

| Configuration | Requirement |
| --- | --- |
| Enabled | Boolean per gateway/company. TASK-020: `payment_gateway_configs.enabled` per method code. |
| Credentials | Encrypted at rest per [[05 Architecture Decisions#ADR-022 — Gateway credential encryption|ADR-022]] (AES-256-GCM envelope; env KEK keyring); never exposed to Staff. TASK-049 stores ciphertext + decrypt metadata on `payment_gateway_configs`. |
| Mode | Sandbox/Test vs Live. TASK-049: `payment_gateway_configs.environment`. |
| Settlement Currencies | USD and/or AED initially; Admin may expand ACTIVE catalog codes. TASK-020: `payment_gateway_settlement_currencies`. |
| Webhook Secret | Encrypted with the same ADR-022 envelope (inside credential payload); required where gateway supports webhooks. TASK-049. |
| Merchant Fee Capture | Optional API-provided or manual reconciliation field. Never used in fixed-rate conversion or invoice balance. |
| Payment Link / Checkout | Optional hosted checkout generation; no customer portal. |
| Status | Healthy / Configuration Error / Disabled (operational indicator). TASK-049 derives status from enablement + credentialsConfigured + environment (no decrypt on GET). |

### 10.3 Payment Record

| Field | Description |
| --- | --- |
| Payment ID | Unique internal identifier. |
| Company ID | Company owning the payment. |
| Invoice ID | Invoice being paid. |
| Customer ID | Snapshot/reference to customer. |
| Payment Method | Stripe / PayPal / Bank Processor / Manual. |
| Gateway Transaction ID | External transaction/reference ID. |
| Payment Status | Core status: Pending / Successful / Failed. Refund/dispute/chargeback state is derived from linked adjustment records and shown as lifecycle badges without deleting or rewriting the original payment. |
| Invoice Currency | Original invoice currency. |
| Invoice Amount Applied | Amount applied to invoice balance. |
| Settlement Currency | USD or AED initially. |
| Fixed Conversion Rate | Locked Admin-defined fixed rate snapshot used for conversion. |
| Rate Version ID | Snapshotted Admin fixed-rate version id; null when same-currency. |
| Rate Effective At | Effective timestamp of the Admin rate version used; payment date when same-currency. |
| Converted Settlement Amount | Invoice amount applied x fixed conversion rate; fee excluded. |
| Processor / Merchant Fee | Optional reconciliation field in settlement currency; excluded from conversion and invoice balance. |
| Actual Amount Received | Optional amount recorded/confirmed as actually received; not auto-derived from merchant fee. |
| Payment Date | Business/effective payment date. |
| Received At | System timestamp from webhook/API/manual confirmation. |
| Rate Source | Admin Fixed Rate, or Same Currency when invoice and settlement codes match. |
| Notes | Internal notes. |
| Created/Confirmed By | User or system/webhook actor. |

TASK-044 persists the provider-agnostic `payments` table (ADR-008): company + invoice + customer FKs; `method_code` (STRIPE/PAYPAL/BANK_PROCESSOR/MANUAL); external transaction reference; status PENDING/SUCCESSFUL/FAILED; invoice/settlement currency codes; invoice amount applied; locked fixed-rate snapshot + optional `rate_version_id`; converted settlement; optional processor fee and actual received (reconciliation only, BR-020); payment date / received_at; source; notes; created/confirmed actors. No gateway credentials, charges, webhooks, allocation, or payment UI. Confirmed financial fields are immutable in domain invariants (BR-004/005); adjustments are Phase 06.

TASK-045 adds the payment domain service and APIs on that schema: create PENDING, confirm (PENDING → SUCCESSFUL), fail (PENDING → FAILED), and GET list/detail. Each write follows authorization → company scope → invoice/customer validation → settlement enablement (BR-006) → Admin fixed-rate resolution (never market FX) → Decimal conversion (fee excluded, BR-020) → persistence → audit. Confirm/fail never rewrite financial columns. Staff cannot record/confirm (`payment.manual.record` denied). No gateway HTTP, allocation, or payment UI.

TASK-046 persists `rate_effective_at` and locks the conversion snapshot on confirm (BR-020 / BR-021): invoice/settlement currencies, applied amount, Admin fixed rate, `rate_source`, `rate_effective_at`, `rate_version_id`, converted settlement. Confirm does not re-resolve a stored snapshot, so a later Admin rate version cannot rewrite a historical payment. Same-currency payments store rate 1, `rate_source=SAME_CURRENCY`, `rate_effective_at=payment_date`, and null `rate_version_id`. Missing Admin rate blocks cross-currency create and incomplete-snapshot confirm. Processor fees remain a separate reconciliation field. Payment detail UI is later (TASK-062).

TASK-047 stores optional `processor_fee_amount` and `actual_received_amount` as reconciliation only (BR-020). Create accepts them from the API; actual received is never derived as converted settlement minus fee. Fees are excluded from conversion and outstanding. Confirm does not rewrite them. Payment detail UI is later (TASK-062).

TASK-048 adds the provider-agnostic `PaymentProvider` registry and capability flags (ADR-008). Application payment records stay normalized. Manual + Fake adapters exist for the contract; live Stripe/PayPal/bank SDKs are later. Domain code does not branch on vendor names. Credentials are not stored on payments (BR-008).

TASK-049 stores company gateway configuration on the existing TASK-020 `payment_gateway_configs` row (enabled, sandbox/live `environment`, non-secret `provider_config`, ADR-022 envelope-encrypted credentials including webhook secret). Normal APIs return safe metadata only (`credentialsConfigured`, status). Decrypt only through server-only `GatewayCredentialService` → `CredentialCipher` → `EnvironmentKeyProvider`. Settlement currencies remain TASK-020. No live charging or webhooks.

TASK-050 records manual payments on the same provider-neutral `payments` model via `recordManualPayment` / `POST /api/payments/manual`: forces `methodCode=MANUAL` + `source=MANUAL`; derives company/customer from the invoice; requires concrete company context; validates MANUAL settlement enablement (BR-006); resolves Admin fixed rate (same-currency rate 1); stores optional fee/actual received as reconciliation only (BR-020); rejects applied amount above open balance from SUCCESSFUL applications (BR-010) without inventing an overpayment allow workflow (US-015); creates PENDING then confirms SUCCESSFUL through the existing lifecycle (immutable snapshot); uses `ManualPaymentAdapter` without hosted checkout or fake webhooks; does not invent gateway transaction IDs. Confirm path allocates invoice paid/outstanding via [[TASK-060 Payment Allocation]]. Staff remains denied (`payment.manual.record` / US-007 default deny).

TASK-051 adds Manual Payment UI on the design system: invoice detail **Record payment** dialog and standalone `/payments/manual` entry (concrete company context required). Forms call `recordManualPaymentAction` → TASK-050 `recordManualPayment` (no duplicated domain logic). Settlement currencies come from company MANUAL settlement config. Conversion preview is display-only; the server still locks the Admin fixed-rate snapshot on record. Fee/actual-received fields are labeled reconciliation-only. Success copy reflects allocation (TASK-060). Staff cannot see the nav item or submit (US-007). Gateway checkout UI remains later.

TASK-052 registers `StripePaymentAdapter` in the PaymentProvider registry (ADR-008). Capabilities: hosted checkout, payment status lookup, webhook signature verify, health check, multi settlement currencies. Unsupported/deferred (at 052): `parseWebhook` (TASK-053), refunds, fee retrieval, hosted checkout UI (TASK-058). Credentials resolve only through server-only `GatewayCredentialService` (company-isolated; sandbox/live env must match `sk_test_` / `sk_live_`). `createPaymentRequest` creates a Stripe Checkout Session using the domain-supplied **converted settlement amount** (Decimal → minor units); never Stripe FX; stable application idempotency key. Status maps to PENDING/SUCCESSFUL/FAILED. No Stripe columns on `payments`. Gateway settings UI shows Healthy / Configuration Error / Disabled and Stripe adapter-active copy.

TASK-053 implements Stripe webhook processing: `POST /api/webhooks/stripe/[companyId]` (company-scoped because webhook secrets are per-company / ADR-022). Signature verification uses the company webhook secret; path is public (no session RBAC). `parseWebhook` maps Checkout Session events to PENDING/SUCCESSFUL/FAILED. Events persist in `payment_events` with unique `(method_code, external_event_id)` for idempotency (E2E-10). Processing matches an existing payment by company + STRIPE + `externalTransactionId`, then confirms/fails via `applyGatewayWebhookPaymentStatus` (actor `WEBHOOK`; no financial field rewrites; no invoice balance mutation). Orphan events (no PENDING payment yet) are stored as `IGNORED` and return 200 — webhooks do not create payments (TASK-058). Inline job dispatcher is used (BullMQ worker remains TASK-099).

TASK-054 registers `PayPalPaymentAdapter` in the PaymentProvider registry (ADR-008). Capabilities: hosted checkout, payment status lookup, webhook signature verify, health check, multi settlement currencies. Unsupported/deferred (at 054): `parseWebhook` (TASK-055), refunds, fee retrieval, capture/hosted checkout UI (TASK-058). Credentials resolve only through server-only `GatewayCredentialService` (company-isolated; sandbox/live selects PayPal API host). `createPaymentRequest` creates a PayPal Orders v2 order using the domain-supplied **converted settlement amount** (Decimal → precision-aligned amount string); never PayPal FX; stable application `PayPal-Request-Id`. Status maps to PENDING/SUCCESSFUL/FAILED. No PayPal columns on `payments`. Gateway settings UI shows Client ID / Client secret / Webhook ID labels and PayPal adapter-active copy.

TASK-055 implements PayPal webhook processing: `POST /api/webhooks/paypal/[companyId]` (company-scoped because webhook credentials are per-company / ADR-022). Signature verification uses company webhook id + client credentials; path is public (no session RBAC). `parseWebhook` maps order/capture lifecycle events to PENDING/SUCCESSFUL/FAILED. Events persist in `payment_events` with unique `(method_code, external_event_id)` for idempotency (E2E-10). Processing matches an existing payment by company + PAYPAL + order `externalTransactionId`, then confirms/fails via `applyGatewayWebhookPaymentStatus` (actor `WEBHOOK`; no financial field rewrites; no invoice balance mutation; no PayPal FX). Orphan events are stored as `IGNORED` and return 200 — webhooks do not create payments (TASK-058). Inline job dispatcher is used (BullMQ worker remains TASK-099).

**Version 1 live PaymentProvider adapters:** MANUAL, STRIPE, PAYPAL. `BANK_PROCESSOR` remains an enablement/config method code only. [[TASK-056 Bank Processor Adapter]] and [[TASK-057 Bank Processor Webhook]] are **DEFERRED** until a concrete vendor and API contract are accepted — no Fake/Generic bank adapter that pretends to charge.

TASK-058 implements optional hosted checkout / payment links (not a customer portal): `createHostedCheckout` / `POST /api/payments/checkout` calls provider `createPaymentRequest` with the Admin fixed-rate **converted settlement amount**, persists a PENDING payment (`source=GATEWAY_API`) with snapshot + provider session/order id, and returns the checkout URL. Confirmation remains webhook/status (TASK-053/055), which allocates via TASK-060. `listHostedCheckoutOptions` / invoice email UI offer only company-enabled, credentialed, `supportsHostedCheckout` methods (disabled/BANK_PROCESSOR omitted). Email send may attach one or more links via existing `paymentLink`. Return/cancel land on `/payments/checkout/return` using trusted `APP_URL` (not a portal).


### 10.4 Partial Payments

An invoice may have multiple payment records. Each successful payment must apply a specific amount in the invoice currency. Invoice status becomes Partially Paid when confirmed applied payments are greater than zero and less than the invoice total, and Paid when the outstanding balance reaches zero within configured rounding tolerance.

TASK-059 enables multiple coexisting payment records per invoice (manual and hosted), each with its own `invoice_amount_applied` and Admin fixed-rate snapshot. Open balance for BR-010 is computed from SUCCESSFUL applications only (PENDING/FAILED do not reserve). Over-application is rejected by default (`PAYMENT_EXCEEDS_OPEN_BALANCE`); overpayment *allow* remains US-015 OPEN. Invoice view lists payment rows via `InvoicePaymentsPanel`.

TASK-060 recalculates invoice `confirmed_paid_amount`, `outstanding_amount`, and status after each SUCCESSFUL confirm (manual or webhook): Partially Paid when confirmed applied > 0 and not settled; Paid when outstanding is within system rounding tolerance (BR-009). Settlement amounts and processor fees never enter the formulas (BR-020). DRAFT/CANCELLED are not rewritten. Audit action `invoices.payment_allocated`. Does not invent overpayment allow (US-015).

TASK-061 adds the Payments transaction list UI at `/payments` (design system): company-scoped filters (company required for Admin; status optional) via existing `listPayments` / `GET /api/payments`. Staff cannot list unassigned company payments (company assignment + invoice visibility). Nav item uses `invoice.create`. Manual payment remains a separate entry.

TASK-062 adds payment detail at `/payments/{id}` (design system): method, status badge (does not rewrite original SUCCESSFUL), invoice amount applied, locked settlement conversion snapshot, optional processor fee and actual received as independent reconciliation fields (BR-020 — UI never deducts fee from converted settlement). Read-only; no confirmed-field edits. Reuses `getPayment` / `GET /api/payments/{id}`. Staff without company assignment receives 403. List and invoice payment rows link to detail.

TASK-063 adds Mark as Dispute: `openPaymentDispute` / `POST /api/payments/{id}/dispute` creates a linked `payment_adjustments` row (`DISPUTE` + `OPEN`/`UNDER_REVIEW`). The original SUCCESSFUL payment is not rewritten (BR-005/023). Outstanding and CB/RF are unchanged until a financial debit/refund is recorded (BR-024). Requires `payment.adjust` (Admin/Compliance); Staff denied.

TASK-064 adds Record/Process full refund: `processFullRefund` / `POST /api/payments/{id}/refund` creates a linked `payment_adjustments` row (`REFUND` + `PROCESSED`). Settlement uses merchant `actualSettlementAmount` when provided, else the original payment converted-settlement snapshot — never today's rate (BR-025). Optionally calls `adapter.refundPayment` when the provider supports refunds. Original SUCCESSFUL financial fields stay locked (BR-023). Processed refund amount is included in CB/RF. Requires `payment.adjust`; Staff denied.

TASK-065 adds Record Partial Refund: `processPartialRefund` / `POST /api/payments/{id}/partial-refund` creates a linked `payment_adjustments` row (`REFUND` + `PROCESSED`) for a partial invoice amount. Cumulative invoice and settlement deductions cannot exceed the original payment (over-refund rejected by default). Settlement uses merchant actual when provided, else invoiceAmount × payment fixed-rate snapshot (BR-025). Optionally calls `adapter.refundPayment` when `supportsPartialRefunds`. Original SUCCESSFUL fields stay locked (BR-023). CB/RF includes processed amount only. Requires `payment.adjust`; Staff denied.

TASK-066 adds Record Chargeback Debit/Loss: `recordChargebackDebitLoss` / `POST /api/payments/{id}/chargeback-debit` creates a linked `payment_adjustments` row (`CHARGEBACK` + `DEBITED`/`LOST`) with merchant reference/case ID, reason, and effective date. Settlement uses merchant actual when provided, else the original payment snapshot (BR-025). Original SUCCESSFUL fields stay locked (BR-023). Included in CB/RF on the debit/loss effective date (BR-024). Requires `payment.adjust`; Staff denied.

TASK-067 adds Record Chargeback Won/Reversal: `recordChargebackWonReversal` / `POST /api/payments/{id}/chargeback-won` creates a linked reversing `payment_adjustments` row (`REVERSAL` + `WON`/`REVERSED`). Amounts default from the prior debit/loss; merchant actual settlement when provided (BR-025). Original SUCCESSFUL payment and debit row are not edited (BR-023 / E2E-16). Subtracts from CB/RF to restore net impact (BR-024). Requires prior debit/loss and `payment.adjust`; Staff denied.

TASK-068 adds adjustment history and notes: `listPaymentAdjustments` / `GET /api/payments/{id}/adjustments` (view per payment access; includes CANCELLED); `addPaymentAdjustmentNote` / `POST /api/payments/{id}/adjustment-note` (`NOTE` + `OPEN`, zero amount, reason/merchant reference fields); `cancelPaymentAdjustment` / `POST /api/payments/{id}/adjustments/{adjustmentId}/cancel` (status CANCELLED retained for audit; excluded from financial totals; never hard-delete). Mutations require `payment.adjust`; Staff denied.

TASK-069 adds Refund/Adjustment view on payment detail (`/payments/{id}`): lifecycle badges beside original SUCCESSFUL (never rewritten); actions for dispute, full/partial refund, chargeback debit/loss, chargeback won/reversal, adjustment note, and soft-cancel; history table distinguishes informational dispute vs financial debit/credit; Staff mutation actions hidden (server still 403 via `payment.adjust`).

TASK-070 adds the shared CB/RF calculation engine in `src/domain/money/cbrf.ts`: CB/RF = processed refunds + chargeback debits/losses − won/reversals; Gross Receipts from SUCCESSFUL payments; Net G.Total = Gross Receipts − CB/RF (BR-024 / BR-026). Open disputes and merchant fees are excluded. Payment detail shows settlement-currency CB/RF impact. Reports consume the same helpers later (TASK-088+).

### 10.5 Automated Gateway Flow

1. User creates/sends invoice and selects one or more enabled payment methods.

2. Application creates a gateway checkout/payment request in a supported settlement currency.

3. If invoice currency differs from settlement currency, the system retrieves the active Admin-defined fixed conversion rate for that currency pair and stores a snapshot of that rate on the payment record.

4. Customer completes payment on the gateway-hosted checkout (or payment is otherwise processed by the provider).

5. Gateway webhook is received and signature validated.

6. Webhook is processed idempotently; duplicate events must not create duplicate payments.

7. Payment status, processor transaction ID, converted settlement amount, optional merchant fee data (when captured), and timestamps are stored. Merchant fees do not affect currency conversion or invoice balance.

8. Invoice payment allocation and status are recalculated from confirmed payment records.

9. Audit log entries are written for payment creation/confirmation and invoice status change.
### 10.6 Manual Payment Flow

- Authorized user selects invoice and Record Payment.

- User enters invoice amount applied, settlement currency, payment method, transaction/reference ID, payment date, and notes. The system automatically applies the configured fixed conversion rate. Authorized users may also record an optional merchant fee for reconciliation only.

- System validates invoice balance and the fixed-rate conversion calculation; overpayment requires explicit permission/workflow. Merchant fee values are excluded from both calculations.

- Confirmation writes an immutable payment record and audit event.


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
- [[02 Current Product Rules]]
- [[Security]]
- [[Testing]]

> [!danger] Financial immutability
> Confirmed financial transactions must preserve historical values. Corrections use adjustment/reversal workflows rather than silently editing historical records.
> Also see [[Invoices]] · [[Payments]] · [[Refunds Disputes Chargebacks]] · [[Currency and Conversion]] · [[02 Current Product Rules]] · [[Audit Logs]] · [[Testing]]

> [!danger] Fixed conversion rates
> Rates are Admin-defined and versioned. Historical payments retain the exact rate snapshot used. Changing a rate affects future transactions only. Never fetch, guess, or substitute a market/gateway rate.
> Also see [[Currency and Conversion]] · [[Payments]] · [[02 Current Product Rules]] · [[Data Model]] · [[Dashboard and Reporting]] · [[Testing]]

> [!tip] Merchant fees
> Merchant/processor fees are reconciliation data only. They must never change invoice balance, the fixed conversion rate, converted settlement amount, or invoice amount.
> Also see [[Payments]] · [[Currency and Conversion]] · [[Dashboard and Reporting]] · [[02 Current Product Rules]] · [[Testing]]

> [!warning] Payment adjustments
> Refunds, disputes, and chargebacks create linked adjustment records. The original successful payment remains preserved.
> Also see [[Payments]] · [[Refunds Disputes Chargebacks]] · [[Audit Logs]] · [[Dashboard and Reporting]] · [[02 Current Product Rules]] · [[Testing]]

> [!warning] Company isolation
> Every company-scoped operation must enforce company access **server-side**. Frontend hiding is not authorization.
> Also see [[Roles and Permissions]] · [[Companies and Brands]] · [[02 Current Product Rules]] · [[Security]] · [[Data Model]] · [[API and Integrations]] · [[Testing]]

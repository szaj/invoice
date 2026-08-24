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
> [[Invoices]] · [[Currency and Conversion]] · [[Refunds Disputes Chargebacks]] · [[API and Integrations]] · [[Error Handling]] · [[Business Rules]] · [[00 Home]]

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
| Bank/Card Processor | Generic provider adapter; exact processor can be implemented as an integration using a standard internal interface. |
| Manual Payment | Authorized user records payment received outside an automated gateway. |

### 10.2 Gateway Configuration Per Company

| Configuration | Requirement |
| --- | --- |
| Enabled | Boolean per gateway/company. TASK-020: `payment_gateway_configs.enabled` per method code. |
| Credentials | Encrypted at rest; never exposed to Staff. TASK-049 (not stored yet). |
| Mode | Sandbox/Test vs Live. TASK-049. |
| Settlement Currencies | USD and/or AED initially; Admin may expand ACTIVE catalog codes. TASK-020: `payment_gateway_settlement_currencies`. |
| Webhook Secret | Encrypted; required where gateway supports webhooks. TASK-049. |
| Merchant Fee Capture | Optional API-provided or manual reconciliation field. Never used in fixed-rate conversion or invoice balance. |
| Payment Link / Checkout | Optional hosted checkout generation; no customer portal. |
| Status | Healthy / Configuration Error / Disabled (operational indicator). |

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


### 10.4 Partial Payments

An invoice may have multiple payment records. Each successful payment must apply a specific amount in the invoice currency. Invoice status becomes Partially Paid when confirmed applied payments are greater than zero and less than the invoice total, and Paid when the outstanding balance reaches zero within configured rounding tolerance.
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
- [[Business Rules]]
- [[Security]]
- [[Testing]]

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

> [!warning] Company isolation
> Every company-scoped operation must enforce company access **server-side**. Frontend hiding is not authorization.
> Also see [[Roles and Permissions]] · [[Companies and Brands]] · [[Business Rules]] · [[Security]] · [[Data Model]] · [[API and Integrations]] · [[Testing]]

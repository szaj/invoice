---
type: module
status: approved
phase: 6
domain: payments
tags:
  - module
  - finance
---

# Refunds Disputes Chargebacks

> [!abstract] Related
> [[Payments]] · [[Currency and Conversion]] · [[Dashboard and Reporting]] · [[Compliance]] · [[Audit Logs]] · [[02 Current Product Rules]] · [[00 Home]]

```mermaid
flowchart TB
    Pay[Original Successful Payment<br/>immutable] --> D[Dispute Open<br/>no financial deduction]
    Pay --> R[Refund / Partial Refund<br/>in CB/RF]
    Pay --> C[Chargeback Debit / Lost<br/>in CB/RF]
    C --> W[Chargeback Won / Reversal<br/>restores net]
    Pay --> N[Adjustment Note]
```

**CB/RF** = processed refunds + chargeback debits/losses − chargeback won/reversal amounts.

### 10.7 Refunds, Reversals, and Chargebacks

Any confirmed customer payment must support payment-level actions for Dispute, Refund, Partial Refund, Chargeback Debit/Loss, and Chargeback Won/Reversal. The original successful payment remains immutable; each action creates a linked payment_adjustment record and audit event.

#### 10.7.1 Payment Detail Actions

Authorized actions on a payment: Mark as Dispute, Record/Process Refund, Record Partial Refund, Record Chargeback Debit/Loss, Record Chargeback Won/Reversal, and Add Adjustment Note.

Adjustment fields: type, amount, reason/reason code, merchant reference/case ID, effective date, notes, evidence attachment (if enabled), created by, and timestamps.

Full and partial adjustments are supported. Cumulative financial deductions must not exceed the original payment amount unless an authorized correction workflow explicitly allows it.

Opening a dispute is informational until a merchant debit/refund is recorded. A Dispute Open status alone does not reduce revenue or CB/RF.

TASK-063 implements Mark as Dispute: `POST /api/payments/{id}/dispute` writes `payment_adjustments` (`DISPUTE` + `OPEN`/`UNDER_REVIEW`) and audit `payments.dispute_opened`. Original SUCCESSFUL financial fields stay locked.

TASK-064 implements Record/Process full refund: `POST /api/payments/{id}/refund` writes `payment_adjustments` (`REFUND` + `PROCESSED`) and audit `payments.refund_processed`. Settlement = merchant actual when provided, else original payment snapshot (BR-025). Optional `adapter.refundPayment` when supported. CB/RF includes the processed refund amount.

TASK-065 implements Record Partial Refund: `POST /api/payments/{id}/partial-refund` writes `payment_adjustments` (`REFUND` + `PROCESSED`) for the partial amount and audit `payments.refund_processed` (`partial: true`). Cumulative invoice/settlement deductions capped at the original payment (over-refund rejected). Settlement = merchant actual when provided, else invoiceAmount × fixed-rate snapshot (BR-025). Optional `adapter.refundPayment` when `supportsPartialRefunds`. CB/RF includes processed amount only.

TASK-066 implements Record Chargeback Debit/Loss: `POST /api/payments/{id}/chargeback-debit` writes `payment_adjustments` (`CHARGEBACK` + `DEBITED`/`LOST`) and audit `payments.chargeback_debited`. Merchant reference/case ID, reason, and effective date are stored. Settlement = merchant actual when provided, else original payment snapshot (BR-025). Original SUCCESSFUL payment preserved. CB/RF includes the debit on the effective date (BR-024).

TASK-067 implements Record Chargeback Won/Reversal: `POST /api/payments/{id}/chargeback-won` writes a reversing `payment_adjustments` row (`REVERSAL` + `WON`/`REVERSED`) and audit `payments.chargeback_won`. Amounts default from the prior debit/loss; merchant actual when provided (BR-025). Original payment and debit row are not edited (BR-023 / E2E-16). CB/RF impact is reduced/restored (BR-024). Requires prior debit/loss.

TASK-068 implements adjustment history and notes: `GET /api/payments/{id}/adjustments` lists linked history (including CANCELLED) for payment viewers; `POST /api/payments/{id}/adjustment-note` writes `NOTE` + `OPEN` (zero amount; reason/merchant reference settings fields); `POST /api/payments/{id}/adjustments/{adjustmentId}/cancel` soft-cancels to `CANCELLED` with audit (never deletes). Cancelled and notes are excluded from financial totals/CB/RF. Mutations require `payment.adjust`.

TASK-069 implements Refund/Adjustment view on payment detail: lifecycle badges without rewriting SUCCESSFUL; payment actions (dispute, refunds, chargebacks, note, cancel); clear informational dispute vs financial debit/credit labels; Staff actions hidden (server enforces `payment.adjust` / 403).

TASK-070 implements the shared CB/RF engine (`computeCbrf`, `computeGrossReceipts`, `computeNetGTotal`, `computeReportingNetTotals`): processed refunds + chargeback debits/losses − won/reversals; open disputes reported separately; merchant fees never included; Net G.Total = Gross Receipts − CB/RF. Payment detail shows CB/RF impact. Reporting modules reuse these helpers.

#### 10.7.2 Adjustment Statuses

| Type / Status | Financial Effect | CB/RF Rule |
| --- | --- | --- |
| Dispute Open / Under Review | No deduction by default | Shown separately; excluded from CB/RF until financial debit/refund. |
| Refund Processed | Deduct refund amount | Included in CB/RF on refund effective date. |
| Partial Refund Processed | Deduct partial amount | Included in CB/RF for processed amount only. |
| Chargeback Debited / Lost | Deduct chargeback amount | Included in CB/RF on debit/loss effective date. |
| Chargeback Won / Reversed | Restore prior deduction | Creates a reversing adjustment and reduces CB/RF impact. |
| Adjustment Cancelled | No effect | Retained for audit; excluded from financial totals. |


#### 10.7.3 Currency Rule for Refunds and Chargebacks

A refund or chargeback does not use the currently active conversion rate merely because it happens later. It is linked to the original payment. If the merchant provides the actual refund/debit amount in USD or AED, store that amount directly. If conversion is required internally, use the original payment's fixed_rate_snapshot, not today's rate.

Example: a January payment used USD -> AED 3.67. The rate later changes to 3.68. A refund/chargeback against the January payment references the January payment and its 3.67 snapshot (or the actual merchant debit amount).


## Related Documentation

### Depends On

- [[Payments]]
- [[Currency and Conversion]]
- [[Roles and Permissions]]

### Integrates With

- [[Audit Logs]]
- [[Dashboard and Reporting]]
- [[Compliance]]

### Technical

- [[02 Current Product Rules]]
- [[Testing]]

> [!danger] Financial immutability
> Confirmed financial transactions must preserve historical values. Corrections use adjustment/reversal workflows rather than silently editing historical records.
> Also see [[Invoices]] · [[Payments]] · [[Refunds Disputes Chargebacks]] · [[Currency and Conversion]] · [[02 Current Product Rules]] · [[Audit Logs]] · [[Testing]]

> [!warning] Payment adjustments
> Refunds, disputes, and chargebacks create linked adjustment records. The original successful payment remains preserved.
> Also see [[Payments]] · [[Refunds Disputes Chargebacks]] · [[Audit Logs]] · [[Dashboard and Reporting]] · [[02 Current Product Rules]] · [[Testing]]

> [!danger] Fixed conversion rates
> Rates are Admin-defined and versioned. Historical payments retain the exact rate snapshot used. Changing a rate affects future transactions only. Never fetch, guess, or substitute a market/gateway rate.
> Also see [[Currency and Conversion]] · [[Payments]] · [[02 Current Product Rules]] · [[Data Model]] · [[Dashboard and Reporting]] · [[Testing]]

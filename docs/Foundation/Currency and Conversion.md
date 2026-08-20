---
type: foundation
status: approved
tags:
  - module
  - finance
---

# Currency and Conversion

> [!abstract] Related
> [[Definitions]] · [[Payments]] · [[Invoices]] · [[Refunds Disputes Chargebacks]] · [[Dashboard and Reporting]] · [[Business Rules]] · [[00 Home]]

> [!danger] Locking rule
> Once a payment is Confirmed/Successful, the fixed conversion rate snapshot and financial amounts are **read-only**. Later Admin rate changes affect future conversions only. Corrections use a controlled adjustment/reversal, never an edit of the original transaction.

```mermaid
flowchart LR
    A[Admin sets USD to AED 3.67<br/>effective 01 Jan] --> P1[January payment stores 3.67 forever]
    B[Admin sets USD to AED 3.68<br/>effective 01 Jul] --> P2[July payment stores 3.68]
    B -.->|does not rewrite| P1
```

**Formulas**

- `converted_settlement_amount = invoice_amount_applied × fixed_conversion_rate`
- `invoice_outstanding = invoice_total − sum(confirmed payment applications in invoice currency)`
- Processor/merchant fee is **optional reconciliation only** and is excluded from both formulas

### 6.1 Default Currencies

| Code | Name | Typical Symbol | Initial Status |
| --- | --- | --- | --- |
| USD | US Dollar | $ | Active |
| AED | UAE Dirham | AED | Active |
| PKR | Pakistani Rupee | PKR / Rs | Active |
| GBP | Pound Sterling | £ | Active |
| AUD | Australian Dollar | A$ | Active |


### 6.2 Currency Administration

- Admin can add a new ISO-style currency record with code, name, symbol, decimal precision, and status.

- Admin can disable a currency. Disabled currencies remain visible on historical records but cannot be selected for new invoices/payments.

- A company can enable a subset of globally active currencies.

- Settlement currencies are configured separately per payment method. Initially payment settlement must support USD and AED only unless expanded by Admin configuration.

### 6.3 Fixed Conversion Rates

The application must use Admin-defined fixed conversion rates only. No live/automatic FX provider, gateway exchange rate, or market-rate lookup is required in Version 1. Rates are maintained centrally by Admin and applied whenever invoice currency differs from the selected settlement currency.

| Field | Stored On Payment | Notes |
| --- | --- | --- |
| invoice_currency | Yes | Original billed currency. |
| invoice_amount_applied | Yes | Amount of invoice currency covered by this payment. |
| settlement_currency | Yes | USD/AED initially. |
| fixed_conversion_rate | Yes | Exact Admin-defined fixed rate snapshot used for this payment. |
| rate_source | Yes | Admin Fixed Rate. |
| rate_effective_at | Yes | Effective timestamp/version of the configured fixed rate used. |
| converted_settlement_amount | Yes | invoice_amount_applied x fixed_conversion_rate. Merchant fee excluded. |
| processor_fee | Optional | Optional reconciliation field in settlement currency; never used in conversion or invoice-balance math. |
| actual_received_amount | Optional | Amount actually recorded/confirmed as received, if the business wants to track it separately. |
| base_currency_equivalent | Recommended | For consolidated reporting using stored fixed reporting-rate snapshots. |


- Admin can create or update a fixed rate for a currency pair (for example GBP -> USD or AUD -> AED). A rate change applies only to future payment/conversion records; historical payment records keep the exact fixed-rate snapshot originally used.

### 6.4 Rate Versioning, Effective Dates, and Frequency

Fixed rates must be versioned. Admin never edits the historical rate used by an existing payment; a new rate version is created whenever the business changes its fixed conversion rate.

- Admin fields: From Currency, To Currency, Fixed Rate, Effective From, Effective To (optional), Frequency/Label (Monthly / Yearly / Manual), Status, Notes, Created By, and Created At.

- A rate may start immediately or be scheduled for a future date/time. Rate changes are prospective only and do not recalculate old payments.

- When a new version becomes active for the same pair, the previous version is expired/closed but retained permanently.

- Every cross-currency payment stores rate_version_id plus fixed_rate_snapshot. Historical reports use the payment snapshot, not the currently active rate.

- Example: USD -> AED = 3.67 from 01-Jan-2026. Admin changes it to 3.68 effective 01-Jul-2026. A January payment remains 3.67 forever; a new July payment uses 3.68.

- If a rate is changed mid-month, only new transactions at/after the activation time use the new rate. Earlier transactions in that month remain unchanged.

| Pair | Rate | Frequency | Effective From | Effective To | Status | Applies To |
| --- | --- | --- | --- | --- | --- | --- |
| USD -> AED | 3.670000 | Yearly | 01-Jan-2026 | 01-Jul-2026 | Expired | Historical transactions |
| USD -> AED | 3.680000 | Monthly/Manual | 01-Jul-2026 |  | Active | New transactions |


### 6.5 Conversion Formula

| converted_settlement_amount = invoice_amount_applied x fixed_conversion_rate invoice_outstanding = invoice_total - sum(confirmed payment applications in invoice currency) processor_fee = optional reconciliation field only; excluded from both formulas |
| --- |


The system calculates the converted settlement amount using the fixed Admin rate stored for the selected currency pair. If invoice and settlement currencies are the same, the conversion rate is 1.000000.

> [!danger] Locking rule
> Locking rule Once a payment reaches Confirmed/Successful status, the fixed conversion rate snapshot and financial amounts used for that payment must be read-only. Later Admin rate changes affect future conversions only. Corrections must use a controlled adjustment/reversal record, not editing of the original transaction.


Merchant/processor fees are separate optional reconciliation data. They must never be included in the currency-conversion formula, must never change the converted settlement amount, and must never change the invoice balance.


## Related Documentation

### Depends On

- [[Definitions]]
- [[Companies and Brands]]

### Integrates With

- [[Payments]]
- [[Invoices]]
- [[Refunds Disputes Chargebacks]]
- [[Dashboard and Reporting]]

### Technical

- [[Business Rules]]
- [[Data Model]]
- [[Testing]]

> [!danger] Fixed conversion rates
> Rates are Admin-defined and versioned. Historical payments retain the exact rate snapshot used. Changing a rate affects future transactions only. Never fetch, guess, or substitute a market/gateway rate.
> Also see [[Currency and Conversion]] · [[Payments]] · [[Business Rules]] · [[Data Model]] · [[Dashboard and Reporting]] · [[Testing]]

> [!tip] Merchant fees
> Merchant/processor fees are reconciliation data only. They must never change invoice balance, the fixed conversion rate, converted settlement amount, or invoice amount.
> Also see [[Payments]] · [[Currency and Conversion]] · [[Dashboard and Reporting]] · [[Business Rules]] · [[Testing]]

> [!danger] Financial immutability
> Confirmed financial transactions must preserve historical values. Corrections use adjustment/reversal workflows rather than silently editing historical records.
> Also see [[Invoices]] · [[Payments]] · [[Refunds Disputes Chargebacks]] · [[Currency and Conversion]] · [[Business Rules]] · [[Audit Logs]] · [[Testing]]

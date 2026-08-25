---
type: reference
status: approved
tags:
  - product
  - finance
---

# Definitions

> [!abstract] Related
> [[Currency and Conversion]] · [[Payments]] · [[Invoices]] · [[Dashboard and Reporting]] · [[00 Home]]

| Term | Definition |
| --- | --- |
| Company / Brand | A tenant-like business unit with its own identity, invoice sequence, currencies, payment methods, gateway credentials, email identity, and reporting. |
| Invoice Currency | Currency in which the customer is billed; e.g., GBP. |
| Settlement Currency | Currency in which funds are processed or received; initially USD or AED. |
| Fixed Conversion Rate | Admin-defined rate used to convert invoice currency to settlement currency. A snapshot is stored with each payment and locked after confirmation. |
| Converted Settlement Amount | Invoice-currency amount applied multiplied by the Admin-defined fixed conversion rate. This amount is calculated without merchant/processor fees. |
| Processor / Merchant Fee | Optional fee recorded for reconciliation. It is stored separately and is never included in the currency conversion or invoice-balance calculation. |
| Actual Amount Received | Optional settlement amount confirmed or entered for reconciliation. It is not derived by subtracting merchant fees from the fixed converted amount. |
| Reporting/Base Currency | Currency used for consolidated dashboard views. Configurable; initial recommendation USD. |
| Outstanding Balance | Invoice total minus confirmed payments applied to that invoice, represented in the invoice currency. |
| Payment Method | Stripe, PayPal, bank/card processor, manual bank transfer, or other enabled mode. |


## Related Documentation

### Depends On

- [[Product Overview]]

### Integrates With

- [[Currency and Conversion]]
- [[Payments]]
- [[Invoices]]
- [[Dashboard and Reporting]]

### Technical

- [[Business Rules]]

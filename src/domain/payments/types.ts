import type { ComplianceStatus } from "@/domain/compliance/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";

/** Application payment status (Payments §10.3 / ADR-008). */
export const PAYMENT_STATUSES = ["PENDING", "SUCCESSFUL", "FAILED"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** How the payment entered the system — not a provider brand. */
export const PAYMENT_SOURCES = ["MANUAL", "GATEWAY_API", "GATEWAY_WEBHOOK", "SYSTEM"] as const;

export type PaymentSource = (typeof PAYMENT_SOURCES)[number];

/** Locked rate provenance (BR-020). Never market/gateway FX. */
export const PAYMENT_RATE_SOURCES = ["ADMIN_FIXED_RATE", "SAME_CURRENCY"] as const;

export type PaymentRateSource = (typeof PAYMENT_RATE_SOURCES)[number];

/**
 * Financial fields that are immutable once status is SUCCESSFUL (BR-004 / BR-005).
 * Corrections use linked adjustments (Phase 06), not silent edits.
 */
export const PAYMENT_CONFIRMED_FINANCIAL_FIELDS = [
  "invoiceCurrencyCode",
  "invoiceAmountApplied",
  "settlementCurrencyCode",
  "fixedConversionRate",
  "rateVersionId",
  "rateSource",
  "rateEffectiveAt",
  "convertedSettlementAmount",
  "processorFeeAmount",
  "actualReceivedAmount",
  "paymentDate",
  "methodCode",
  "externalTransactionId",
] as const;

export type PaymentConfirmedFinancialField = (typeof PAYMENT_CONFIRMED_FINANCIAL_FIELDS)[number];

export const PAYMENT_INVALID_INPUT = "Check the payment details and try again.";
export const PAYMENT_COMPANY_REQUIRED = "Every payment requires a company.";
export const PAYMENT_INVOICE_REQUIRED = "Every payment requires an invoice.";
export const PAYMENT_CUSTOMER_REQUIRED = "Every payment requires a customer.";
export const PAYMENT_AMOUNT_REQUIRED = "Invoice amount applied is required.";
export const PAYMENT_CURRENCY_REQUIRED = "Invoice and settlement currency codes are required.";
export const PAYMENT_NOT_FOUND = "Payment not found.";
export const PAYMENT_UNAVAILABLE = "Payment management is temporarily unavailable.";
export const PAYMENT_CONFIRMED_IMMUTABLE =
  "Confirmed payment financial fields cannot be edited. Use an adjustment workflow.";
export const PAYMENT_HARD_DELETE_FORBIDDEN =
  "Paid or confirmed payments must not be hard-deleted (BR-004).";
export const PAYMENT_FEE_MUST_NOT_AFFECT_SETTLEMENT =
  "Processor fee must not change converted settlement amount (BR-020).";
export const PAYMENT_FEE_MUST_NOT_AFFECT_BALANCE =
  "Processor fee must not change invoice outstanding or applied amount (BR-020).";
export const PAYMENT_JS_NUMBER_FORBIDDEN =
  "JavaScript number is not allowed for authoritative payment money fields.";
export const PAYMENT_ILLEGAL_TRANSITION = "That payment status change is not allowed.";
export const PAYMENT_INVOICE_NOT_PAYABLE =
  "Payments cannot be recorded against draft or cancelled invoices.";
export const PAYMENT_AMOUNT_NOT_POSITIVE = "Invoice amount applied must be greater than zero.";
export const PAYMENT_EXCEEDS_OPEN_BALANCE =
  "Payment amount cannot exceed the open invoice balance.";
export const PAYMENT_RECORD_FORBIDDEN = "You do not have permission to record or confirm payments.";
export const PAYMENT_COMPANY_SCOPE_REQUIRED = "Select a company before listing payments.";
export const PAYMENT_MANUAL_PROVIDER_MISCONFIGURED =
  "Manual payment recording is misconfigured for gateway-style processing.";
export const PAYMENT_CHECKOUT_METHOD_UNSUPPORTED =
  "That payment method does not support hosted checkout for this company.";
export const PAYMENT_CHECKOUT_CREDENTIALS_REQUIRED =
  "Configure gateway credentials before creating a hosted checkout.";
export const PAYMENT_CHECKOUT_NO_OUTSTANDING =
  "There is no outstanding invoice balance to collect.";
export const PAYMENT_CHECKOUT_PROVIDER_FAILED =
  "The payment provider could not create a hosted checkout. Try again.";

/**
 * Provider-agnostic payment record (Payments §10.3 / TASK-044).
 * Amounts are Decimal strings — never JS number.
 * Gateway credentials are never stored on this record.
 */
export type PaymentRecord = {
  readonly id: string;
  readonly companyId: string;
  readonly invoiceId: string;
  readonly customerId: string;
  readonly methodCode: PaymentMethodCode;
  readonly externalTransactionId: string | null;
  readonly status: PaymentStatus;
  readonly complianceStatus: ComplianceStatus;
  readonly invoiceCurrencyCode: string;
  readonly invoiceAmountApplied: string;
  readonly settlementCurrencyCode: string;
  readonly fixedConversionRate: string;
  readonly rateVersionId: string | null;
  readonly rateSource: PaymentRateSource;
  /** Effective timestamp of the Admin rate version used (payment date when same-currency). */
  readonly rateEffectiveAt: Date | null;
  readonly convertedSettlementAmount: string;
  /** Optional reconciliation fee in settlement currency; excluded from conversion/balance. */
  readonly processorFeeAmount: string | null;
  /** Optional actual received; not auto-derived from fee. */
  readonly actualReceivedAmount: string | null;
  readonly paymentDate: Date;
  readonly receivedAt: Date | null;
  readonly source: PaymentSource;
  readonly notes: string | null;
  readonly createdByUserId: string | null;
  readonly confirmedByUserId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

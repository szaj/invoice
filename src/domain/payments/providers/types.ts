import type { GatewayEnvironment } from "@/domain/gateway-config/types";
import type { PaymentStatus } from "@/domain/payments/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";

/**
 * Capability flags (ADR-008). Core payment logic must branch on these,
 * never on a concrete vendor name.
 */
export const PAYMENT_PROVIDER_CAPABILITY_FLAGS = [
  "supportsHostedCheckout",
  "supportsWebhooks",
  "supportsRefunds",
  "supportsPartialRefunds",
  "supportsFeeRetrieval",
  "supportsPaymentStatusLookup",
  "supportsMultipleSettlementCurrencies",
  "supportsHealthCheck",
] as const;

export type PaymentProviderCapability = (typeof PAYMENT_PROVIDER_CAPABILITY_FLAGS)[number];

export type PaymentProviderCapabilities = {
  readonly [K in PaymentProviderCapability]: boolean;
};

/**
 * Company gateway config used to resolve an adapter (TASK-020 / TASK-049 shape).
 * Encrypted secrets stay in the gateway config store — this type never carries credential material.
 */
export type PaymentProviderGatewayConfig = {
  readonly companyId: string;
  readonly methodCode: PaymentMethodCode;
  readonly enabled: boolean;
  readonly environment: GatewayEnvironment | null;
  readonly enabledSettlementCurrencyCodes: readonly string[];
  /** Presence only. Never a secret, token, or raw credential. */
  readonly credentialsConfigured: boolean;
};

export type CreatePaymentRequestInput = {
  readonly companyId: string;
  readonly invoiceId: string;
  readonly customerId: string;
  readonly invoiceCurrencyCode: string;
  readonly invoiceAmountApplied: string;
  readonly settlementCurrencyCode: string;
  /** Catalog decimal precision for the settlement currency (0–6). Used for provider minor units. */
  readonly settlementDecimalPrecision: number;
  /** Domain-computed converted settlement. Adapters must not recompute FX. */
  readonly convertedSettlementAmount: string;
  /** Hosted checkout return URLs (provider-neutral). */
  readonly successUrl: string;
  readonly cancelUrl: string;
};

export type CreatePaymentRequestResult = {
  readonly externalTransactionId: string;
  readonly status: PaymentStatus;
  readonly checkoutUrl: string | null;
};

export type GetPaymentStatusInput = {
  /** Required for company-isolated credential resolution (ADR-022). */
  readonly companyId: string;
  readonly externalTransactionId: string;
};

export type GetPaymentStatusResult = {
  readonly externalTransactionId: string;
  readonly status: PaymentStatus;
};

export type WebhookHeaders = Readonly<Record<string, string | string[] | undefined>>;

export type ProviderWebhookInput = {
  /** Required for company-isolated webhook secret resolution (ADR-022). */
  readonly companyId: string;
  readonly payload: string;
  readonly headers: WebhookHeaders;
};

export type VerifyWebhookResult = {
  readonly verified: true;
};

export type ParseWebhookResult = {
  readonly externalEventId: string;
  readonly externalTransactionId: string;
  readonly status: PaymentStatus;
  /** Reconciliation only; never applied to invoice balance or converted settlement. */
  readonly processorFeeAmount: string | null;
};

export type RefundPaymentInput = {
  readonly companyId: string;
  readonly externalTransactionId: string;
  readonly amount: string;
  readonly settlementCurrencyCode: string;
  readonly partial: boolean;
};

export type RefundPaymentResult = {
  readonly externalRefundId: string;
  readonly amount: string;
  readonly settlementCurrencyCode: string;
};

export type GetFeesInput = {
  readonly companyId: string;
  readonly externalTransactionId: string;
};

export type GetFeesResult = {
  readonly processorFeeAmount: string | null;
  readonly settlementCurrencyCode: string;
};

export type ProviderHealthStatus = "HEALTHY" | "CONFIGURATION_ERROR" | "DISABLED";

export type HealthCheckResult = {
  readonly healthy: boolean;
  readonly status: ProviderHealthStatus;
};

/**
 * Provider-agnostic adapter contract (ADR-008 / TASK-048).
 * SDKs, credentials, payloads, and status mapping stay inside adapters.
 * Results are normalized Pending / Successful / Failed.
 */
export interface PaymentProvider {
  readonly methodCode: PaymentMethodCode;
  readonly capabilities: PaymentProviderCapabilities;
  createPaymentRequest(input: CreatePaymentRequestInput): Promise<CreatePaymentRequestResult>;
  getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusResult>;
  verifyWebhook(input: ProviderWebhookInput): Promise<VerifyWebhookResult>;
  parseWebhook(input: ProviderWebhookInput): Promise<ParseWebhookResult>;
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;
  getFees(input: GetFeesInput): Promise<GetFeesResult>;
  healthCheck(config: PaymentProviderGatewayConfig): Promise<HealthCheckResult>;
}

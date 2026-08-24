import "server-only";

import {
  assertCurrencyPrecision,
  moneyDecimal,
  normalizeCurrencyCode,
  toDecimalString,
} from "@/domain/money";
import { normalizeProviderCurrencyCode, toProviderAmountInteger } from "@/domain/money/minor-units";
import { assertPaymentProviderCapability } from "@/domain/payments/providers/capabilities";
import {
  PROVIDER_CAPABILITY_UNSUPPORTED,
  PROVIDER_CONFIGURATION_ERROR,
  PROVIDER_CREDENTIALS_MISSING,
  PROVIDER_EVENT_UNSUPPORTED,
  PROVIDER_INVALID_INPUT,
  PROVIDER_INVALID_RESPONSE,
  PROVIDER_METHOD_DISABLED,
  PROVIDER_REQUEST_REJECTED,
  PROVIDER_TRANSACTION_NOT_FOUND,
  PROVIDER_UNAVAILABLE,
  PROVIDER_WEBHOOK_INVALID,
} from "@/domain/payments/providers/errors";
import type {
  CreatePaymentRequestInput,
  CreatePaymentRequestResult,
  GetFeesInput,
  GetFeesResult,
  GetPaymentStatusInput,
  GetPaymentStatusResult,
  HealthCheckResult,
  ParseWebhookResult,
  PaymentProvider,
  PaymentProviderCapabilities,
  PaymentProviderGatewayConfig,
  ProviderWebhookInput,
  RefundPaymentInput,
  RefundPaymentResult,
  VerifyWebhookResult,
} from "@/domain/payments/providers/types";
import type { PaymentStatus } from "@/domain/payments/types";
import { logger } from "@/lib/logger";
import {
  createGatewayCredentialResolver,
  type GatewayCredentialResolver,
} from "@/server/gateway-credentials/resolve-gateway-credentials";
import {
  createDefaultStripeClientFactory,
  type StripeApiClient,
  type StripeClientFactory,
} from "@/server/payments/providers/stripe/stripe-client";
import {
  assertStripeSecretMatchesEnvironment,
  parseStripeCredentials,
} from "@/server/payments/providers/stripe/stripe-credentials";
import { mapStripeWebhookEvent } from "@/server/payments/providers/stripe/stripe-webhook-map";

const STRIPE_CAPABILITIES: PaymentProviderCapabilities = {
  supportsHostedCheckout: true,
  supportsWebhooks: true,
  supportsRefunds: false,
  supportsPartialRefunds: false,
  supportsFeeRetrieval: false,
  supportsPaymentStatusLookup: true,
  supportsMultipleSettlementCurrencies: true,
  supportsHealthCheck: true,
};

export type StripePaymentAdapterDeps = {
  readonly credentialResolver?: GatewayCredentialResolver;
  readonly createStripeClient?: StripeClientFactory;
};

/**
 * Stable application-controlled idempotency key for a logical payment request.
 * Same company/invoice/settlement amount/currency/precision/URLs → same key on retry.
 */
export function buildStripePaymentRequestIdempotencyKey(input: CreatePaymentRequestInput): string {
  return [
    "stripe",
    "checkout",
    input.companyId,
    input.invoiceId,
    input.settlementCurrencyCode,
    toDecimalString(input.convertedSettlementAmount),
    String(assertCurrencyPrecision(input.settlementDecimalPrecision)),
    input.successUrl,
    input.cancelUrl,
  ].join(":");
}

function headerValue(headers: ProviderWebhookInput["headers"], name: string): string | null {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw) && typeof raw[0] === "string") {
    return raw[0];
  }
  return null;
}

function mapCheckoutSessionStatus(session: {
  status: string | null;
  payment_status: string | null;
}): PaymentStatus {
  if (session.status === "expired") {
    return "FAILED";
  }
  if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
    return "SUCCESSFUL";
  }
  if (session.payment_status === "unpaid" || session.status === "open") {
    return "PENDING";
  }
  if (session.status === "complete" && session.payment_status === "unpaid") {
    return "PENDING";
  }
  throw new Error(PROVIDER_INVALID_RESPONSE);
}

function isStripeNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error as { statusCode?: number }).statusCode === 404
  );
}

function translateStripeError(error: unknown): Error {
  if (error instanceof Error) {
    const message = error.message;
    if (
      message === PROVIDER_METHOD_DISABLED ||
      message === PROVIDER_CREDENTIALS_MISSING ||
      message === PROVIDER_CONFIGURATION_ERROR ||
      message === PROVIDER_INVALID_INPUT ||
      message === PROVIDER_INVALID_RESPONSE ||
      message === PROVIDER_EVENT_UNSUPPORTED ||
      message === PROVIDER_WEBHOOK_INVALID ||
      message === PROVIDER_TRANSACTION_NOT_FOUND ||
      message === PROVIDER_CAPABILITY_UNSUPPORTED ||
      message === PROVIDER_UNAVAILABLE ||
      message === PROVIDER_REQUEST_REJECTED
    ) {
      return error;
    }
  }

  if (isStripeNotFound(error)) {
    return new Error(PROVIDER_TRANSACTION_NOT_FOUND);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof (error as { type?: string }).type === "string"
  ) {
    const type = (error as { type: string }).type;
    if (type === "StripeConnectionError" || type === "StripeAPIError") {
      return new Error(PROVIDER_UNAVAILABLE);
    }
    if (type === "StripeAuthenticationError") {
      return new Error(PROVIDER_CONFIGURATION_ERROR);
    }
    if (type === "StripeCardError" || type === "StripeInvalidRequestError") {
      return new Error(PROVIDER_REQUEST_REJECTED);
    }
    if (type === "StripeSignatureVerificationError") {
      return new Error(PROVIDER_WEBHOOK_INVALID);
    }
  }

  return new Error(PROVIDER_UNAVAILABLE);
}

function safeProviderErrorLog(event: string, companyId: string, error: unknown): void {
  const message = error instanceof Error ? error.message : "unknown";
  logger.error(
    {
      event,
      companyId,
      methodCode: "STRIPE",
      // Never log secrets, Authorization headers, or decrypted credential objects.
      err: message.slice(0, 200),
    },
    "Stripe provider operation failed",
  );
}

/**
 * Stripe PaymentProvider adapter (TASK-052 / TASK-053 / ADR-008).
 * SDK calls, credentials, status mapping, and webhook verify/parse stay here.
 * Refunds / fee retrieval / hosted checkout UI remain later tasks.
 */
export class StripePaymentAdapter implements PaymentProvider {
  readonly methodCode = "STRIPE" as const;
  readonly capabilities = STRIPE_CAPABILITIES;

  private readonly credentialResolverOverride: GatewayCredentialResolver | undefined;
  private readonly createStripeClient: StripeClientFactory;
  private lazyCredentialResolver: GatewayCredentialResolver | undefined;

  constructor(deps: StripePaymentAdapterDeps = {}) {
    this.credentialResolverOverride = deps.credentialResolver;
    this.createStripeClient = deps.createStripeClient ?? createDefaultStripeClientFactory();
  }

  private get credentialResolver(): GatewayCredentialResolver {
    if (this.credentialResolverOverride) {
      return this.credentialResolverOverride;
    }
    if (!this.lazyCredentialResolver) {
      this.lazyCredentialResolver = createGatewayCredentialResolver();
    }
    return this.lazyCredentialResolver;
  }

  async createPaymentRequest(
    input: CreatePaymentRequestInput,
  ): Promise<CreatePaymentRequestResult> {
    assertPaymentProviderCapability(this, "supportsHostedCheckout");
    try {
      moneyDecimal(input.invoiceAmountApplied);
      moneyDecimal(input.convertedSettlementAmount);
      assertCurrencyPrecision(input.settlementDecimalPrecision);
      normalizeCurrencyCode(input.settlementCurrencyCode);
      if (!input.successUrl.trim() || !input.cancelUrl.trim()) {
        throw new Error(PROVIDER_INVALID_INPUT);
      }

      const client = await this.clientForCompany(input.companyId);
      const unitAmount = toProviderAmountInteger(
        input.convertedSettlementAmount,
        input.settlementDecimalPrecision,
      );
      const currency = normalizeProviderCurrencyCode(input.settlementCurrencyCode);
      const idempotencyKey = buildStripePaymentRequestIdempotencyKey(input);

      const session = await client.checkout.sessions.create(
        {
          mode: "payment",
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          client_reference_id: input.invoiceId,
          metadata: {
            companyId: input.companyId,
            invoiceId: input.invoiceId,
            customerId: input.customerId,
            invoiceCurrencyCode: input.invoiceCurrencyCode,
            settlementCurrencyCode: input.settlementCurrencyCode,
            // Authoritative converted settlement — never recomputed from Stripe FX.
            convertedSettlementAmount: toDecimalString(input.convertedSettlementAmount),
          },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency,
                unit_amount: unitAmount,
                product_data: {
                  name: `Invoice ${input.invoiceId}`,
                },
              },
            },
          ],
        },
        { idempotencyKey },
      );

      if (!session.id || typeof session.id !== "string") {
        throw new Error(PROVIDER_INVALID_RESPONSE);
      }

      return {
        externalTransactionId: session.id,
        status: "PENDING",
        checkoutUrl: session.url,
      };
    } catch (error) {
      safeProviderErrorLog("stripe.create_payment_request_failed", input.companyId, error);
      throw translateStripeError(error);
    }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusResult> {
    assertPaymentProviderCapability(this, "supportsPaymentStatusLookup");
    try {
      if (!input.externalTransactionId.trim()) {
        throw new Error(PROVIDER_INVALID_INPUT);
      }
      const client = await this.clientForCompany(input.companyId);
      const session = await client.checkout.sessions.retrieve(input.externalTransactionId);
      if (!session.id) {
        throw new Error(PROVIDER_INVALID_RESPONSE);
      }
      return {
        externalTransactionId: session.id,
        status: mapCheckoutSessionStatus(session),
      };
    } catch (error) {
      safeProviderErrorLog("stripe.get_payment_status_failed", input.companyId, error);
      throw translateStripeError(error);
    }
  }

  async verifyWebhook(input: ProviderWebhookInput): Promise<VerifyWebhookResult> {
    assertPaymentProviderCapability(this, "supportsWebhooks");
    try {
      const resolved = await this.credentialResolver.resolveForProvider({
        companyId: input.companyId,
        methodCode: "STRIPE",
      });
      const credentials = parseStripeCredentials(resolved.credentials);
      assertStripeSecretMatchesEnvironment(credentials.secretKey, resolved.environment);
      if (!credentials.webhookSecret) {
        throw new Error(PROVIDER_CREDENTIALS_MISSING);
      }
      const signature = headerValue(input.headers, "stripe-signature");
      if (!signature) {
        throw new Error(PROVIDER_WEBHOOK_INVALID);
      }
      const client = this.createStripeClient(credentials.secretKey);
      client.webhooks.constructEvent(input.payload, signature, credentials.webhookSecret);
      return { verified: true };
    } catch (error) {
      safeProviderErrorLog("stripe.verify_webhook_failed", input.companyId, error);
      throw translateStripeError(error);
    }
  }

  async parseWebhook(input: ProviderWebhookInput): Promise<ParseWebhookResult> {
    assertPaymentProviderCapability(this, "supportsWebhooks");
    try {
      const resolved = await this.credentialResolver.resolveForProvider({
        companyId: input.companyId,
        methodCode: "STRIPE",
      });
      const credentials = parseStripeCredentials(resolved.credentials);
      assertStripeSecretMatchesEnvironment(credentials.secretKey, resolved.environment);
      if (!credentials.webhookSecret) {
        throw new Error(PROVIDER_CREDENTIALS_MISSING);
      }
      const signature = headerValue(input.headers, "stripe-signature");
      if (!signature) {
        throw new Error(PROVIDER_WEBHOOK_INVALID);
      }
      const client = this.createStripeClient(credentials.secretKey);
      const event = client.webhooks.constructEvent(
        input.payload,
        signature,
        credentials.webhookSecret,
      );
      const mapped = mapStripeWebhookEvent(event);
      return {
        externalEventId: mapped.externalEventId,
        externalTransactionId: mapped.externalTransactionId,
        status: mapped.status,
        processorFeeAmount: mapped.processorFeeAmount,
      };
    } catch (error) {
      safeProviderErrorLog("stripe.parse_webhook_failed", input.companyId, error);
      throw translateStripeError(error);
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    void input;
    assertPaymentProviderCapability(this, "supportsRefunds");
    throw new Error(PROVIDER_CAPABILITY_UNSUPPORTED);
  }

  async getFees(input: GetFeesInput): Promise<GetFeesResult> {
    void input;
    assertPaymentProviderCapability(this, "supportsFeeRetrieval");
    throw new Error(PROVIDER_CAPABILITY_UNSUPPORTED);
  }

  async healthCheck(config: PaymentProviderGatewayConfig): Promise<HealthCheckResult> {
    assertPaymentProviderCapability(this, "supportsHealthCheck");
    if (config.methodCode !== "STRIPE") {
      return { healthy: false, status: "CONFIGURATION_ERROR" };
    }
    if (!config.enabled) {
      return { healthy: false, status: "DISABLED" };
    }
    if (!config.credentialsConfigured || config.environment == null) {
      return { healthy: false, status: "CONFIGURATION_ERROR" };
    }
    return { healthy: true, status: "HEALTHY" };
  }

  private async clientForCompany(companyId: string): Promise<StripeApiClient> {
    const resolved = await this.credentialResolver.resolveForProvider({
      companyId,
      methodCode: "STRIPE",
    });
    const credentials = parseStripeCredentials(resolved.credentials);
    assertStripeSecretMatchesEnvironment(credentials.secretKey, resolved.environment);
    return this.createStripeClient(credentials.secretKey);
  }
}

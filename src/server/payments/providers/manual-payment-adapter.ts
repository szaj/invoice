import "server-only";

import { assertPaymentProviderCapability } from "@/domain/payments/providers/capabilities";
import { PROVIDER_CAPABILITY_UNSUPPORTED } from "@/domain/payments/providers/errors";
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

const MANUAL_CAPABILITIES: PaymentProviderCapabilities = {
  supportsHostedCheckout: false,
  supportsWebhooks: false,
  supportsRefunds: false,
  supportsPartialRefunds: false,
  supportsFeeRetrieval: false,
  supportsPaymentStatusLookup: false,
  supportsMultipleSettlementCurrencies: true,
  supportsHealthCheck: true,
};

/**
 * Manual payments use the application payment domain without gateway HTTP or fake webhooks (ADR-008).
 */
export class ManualPaymentAdapter implements PaymentProvider {
  readonly methodCode = "MANUAL" as const;
  readonly capabilities = MANUAL_CAPABILITIES;

  async createPaymentRequest(
    input: CreatePaymentRequestInput,
  ): Promise<CreatePaymentRequestResult> {
    void input;
    assertPaymentProviderCapability(this, "supportsHostedCheckout");
    throw new Error(PROVIDER_CAPABILITY_UNSUPPORTED);
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusResult> {
    void input;
    assertPaymentProviderCapability(this, "supportsPaymentStatusLookup");
    throw new Error(PROVIDER_CAPABILITY_UNSUPPORTED);
  }

  async verifyWebhook(input: ProviderWebhookInput): Promise<VerifyWebhookResult> {
    void input;
    assertPaymentProviderCapability(this, "supportsWebhooks");
    throw new Error(PROVIDER_CAPABILITY_UNSUPPORTED);
  }

  async parseWebhook(input: ProviderWebhookInput): Promise<ParseWebhookResult> {
    void input;
    assertPaymentProviderCapability(this, "supportsWebhooks");
    throw new Error(PROVIDER_CAPABILITY_UNSUPPORTED);
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
    if (!config.enabled) {
      return { healthy: false, status: "DISABLED" };
    }
    return { healthy: true, status: "HEALTHY" };
  }
}

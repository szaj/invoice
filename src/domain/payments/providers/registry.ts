import {
  PROVIDER_ALREADY_REGISTERED,
  PROVIDER_METHOD_DISABLED,
  PROVIDER_NOT_REGISTERED,
} from "@/domain/payments/providers/errors";
import type {
  PaymentProvider,
  PaymentProviderGatewayConfig,
} from "@/domain/payments/providers/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";

/**
 * In-process PaymentProvider registry (ADR-008).
 * Adding a provider is register() + adapter; not a domain rewrite.
 */
export class PaymentProviderRegistry {
  private readonly providers = new Map<PaymentMethodCode, PaymentProvider>();

  register(provider: PaymentProvider): this {
    if (this.providers.has(provider.methodCode)) {
      throw new Error(PROVIDER_ALREADY_REGISTERED);
    }
    this.providers.set(provider.methodCode, provider);
    return this;
  }

  get(methodCode: PaymentMethodCode): PaymentProvider | null {
    return this.providers.get(methodCode) ?? null;
  }

  require(methodCode: PaymentMethodCode): PaymentProvider {
    const provider = this.get(methodCode);
    if (!provider) {
      throw new Error(PROVIDER_NOT_REGISTERED);
    }
    return provider;
  }

  list(): readonly PaymentProvider[] {
    return [...this.providers.values()];
  }
}

/**
 * Resolve an adapter from company gateway enablement (TASK-020) + registry.
 * Does not read or return credentials (BR-008 / TASK-049).
 */
export function resolvePaymentProvider(
  registry: PaymentProviderRegistry,
  config: PaymentProviderGatewayConfig | null,
): PaymentProvider {
  if (!config || !config.enabled) {
    throw new Error(PROVIDER_METHOD_DISABLED);
  }
  return registry.require(config.methodCode);
}

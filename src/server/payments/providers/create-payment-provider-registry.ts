import "server-only";

import { PaymentProviderRegistry } from "@/domain/payments/providers/registry";
import type { PaymentProvider } from "@/domain/payments/providers/types";
import { ManualPaymentAdapter } from "@/server/payments/providers/manual-payment-adapter";
import { PayPalPaymentAdapter } from "@/server/payments/providers/paypal/paypal-payment-adapter";
import { StripePaymentAdapter } from "@/server/payments/providers/stripe/stripe-payment-adapter";

/**
 * Default registry: Manual + Stripe + PayPal adapters (ADR-008).
 * Bank adapter registers in a later task.
 */
export function createPaymentProviderRegistry(
  extraProviders: readonly PaymentProvider[] = [],
): PaymentProviderRegistry {
  const registry = new PaymentProviderRegistry();
  registry.register(new ManualPaymentAdapter());
  registry.register(new StripePaymentAdapter());
  registry.register(new PayPalPaymentAdapter());
  for (const provider of extraProviders) {
    registry.register(provider);
  }
  return registry;
}

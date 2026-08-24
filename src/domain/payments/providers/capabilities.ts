import { PROVIDER_CAPABILITY_UNSUPPORTED } from "@/domain/payments/providers/errors";
import type { PaymentProvider, PaymentProviderCapability } from "@/domain/payments/providers/types";

export function providerSupports(
  provider: Pick<PaymentProvider, "capabilities">,
  capability: PaymentProviderCapability,
): boolean {
  return provider.capabilities[capability] === true;
}

export function assertPaymentProviderCapability(
  provider: Pick<PaymentProvider, "capabilities">,
  capability: PaymentProviderCapability,
): void {
  if (!providerSupports(provider, capability)) {
    throw new Error(PROVIDER_CAPABILITY_UNSUPPORTED);
  }
}

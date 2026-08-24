import "server-only";

import Stripe from "stripe";

/**
 * Narrow Stripe API surface used by StripePaymentAdapter.
 * Keeps SDK coupling inside the adapter boundary (ADR-008).
 */
export type StripeCheckoutSessionCreateParams = {
  readonly mode: "payment";
  readonly success_url: string;
  readonly cancel_url: string;
  readonly client_reference_id?: string;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly line_items: ReadonlyArray<{
    readonly quantity: number;
    readonly price_data: {
      readonly currency: string;
      readonly unit_amount: number;
      readonly product_data: { readonly name: string };
    };
  }>;
};

export type StripeCheckoutSession = {
  readonly id: string;
  readonly url: string | null;
  readonly status: string | null;
  readonly payment_status: string | null;
};

export type StripeRequestOptions = {
  readonly idempotencyKey?: string;
};

export type StripeWebhookEvent = {
  readonly id: string;
  readonly type: string;
  readonly data: { readonly object: Record<string, unknown> };
};

export type StripeApiClient = {
  checkout: {
    sessions: {
      create(
        params: StripeCheckoutSessionCreateParams,
        options?: StripeRequestOptions,
      ): Promise<StripeCheckoutSession>;
      retrieve(sessionId: string): Promise<StripeCheckoutSession>;
    };
  };
  webhooks: {
    constructEvent(
      payload: string | Buffer,
      header: string | Buffer,
      secret: string,
    ): StripeWebhookEvent;
  };
};

export type StripeClientFactory = (secretKey: string) => StripeApiClient;

/**
 * Default factory — the only place that constructs the official Stripe SDK client.
 */
export function createDefaultStripeClientFactory(): StripeClientFactory {
  return (secretKey: string): StripeApiClient => {
    const stripe = new Stripe(secretKey, {
      // Pin a known API version; bump deliberately when upgrading the integration.
      apiVersion: "2025-08-27.basil",
      typescript: true,
    });

    return {
      checkout: {
        sessions: {
          create: (params, options) =>
            stripe.checkout.sessions.create(
              params as Stripe.Checkout.SessionCreateParams,
              options?.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : undefined,
            ) as Promise<StripeCheckoutSession>,
          retrieve: (sessionId) =>
            stripe.checkout.sessions.retrieve(sessionId) as Promise<StripeCheckoutSession>,
        },
      },
      webhooks: {
        constructEvent: (payload, header, secret) =>
          stripe.webhooks.constructEvent(payload, header, secret) as unknown as StripeWebhookEvent,
      },
    };
  };
}

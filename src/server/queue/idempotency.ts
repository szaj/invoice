import { createHash } from "node:crypto";

export function hashToBullJobId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function parseStripeExternalEventId(payload: string): string | null {
  try {
    const parsed = JSON.parse(payload) as { id?: unknown };
    return typeof parsed.id === "string" && parsed.id.trim().length > 0 ? parsed.id : null;
  } catch {
    return null;
  }
}

export function parsePayPalExternalEventId(payload: string): string | null {
  try {
    const parsed = JSON.parse(payload) as { id?: unknown };
    return typeof parsed.id === "string" && parsed.id.trim().length > 0 ? parsed.id : null;
  } catch {
    return null;
  }
}

export function stripeWebhookIdempotencyKey(companyId: string, payload: string): string | null {
  const externalEventId = parseStripeExternalEventId(payload);
  return externalEventId ? `stripe:${companyId}:${externalEventId}` : null;
}

export function paypalWebhookIdempotencyKey(companyId: string, payload: string): string | null {
  const externalEventId = parsePayPalExternalEventId(payload);
  return externalEventId ? `paypal:${companyId}:${externalEventId}` : null;
}

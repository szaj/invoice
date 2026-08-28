import { describe, expect, it, vi } from "vitest";

import {
  paypalWebhookIdempotencyKey,
  parseStripeExternalEventId,
  stripeWebhookIdempotencyKey,
} from "@/server/queue/idempotency";
import { getDefaultJobOptions, isQueueEnabled } from "@/server/queue/config";
import { createStripeWebhookBullMqDispatcher } from "@/server/queue/dispatchers";
import * as enqueueModule from "@/server/queue/enqueue";

describe("queue hardening (TASK-099)", () => {
  it("detects queue enablement from REDIS_URL", () => {
    expect(isQueueEnabled({ REDIS_URL: undefined })).toBe(false);
    expect(isQueueEnabled({ REDIS_URL: "redis://localhost:6379" })).toBe(true);
    expect(isQueueEnabled({ REDIS_URL: "   " })).toBe(false);
  });

  it("applies exponential retry defaults", () => {
    const options = getDefaultJobOptions();
    expect(options.attempts).toBe(5);
    expect(options.backoff).toEqual({ type: "exponential", delay: 2_000 });
  });

  it("builds stable webhook idempotency keys from provider event IDs", () => {
    const payload = JSON.stringify({ id: "evt_123", type: "checkout.session.completed" });
    expect(parseStripeExternalEventId(payload)).toBe("evt_123");
    expect(stripeWebhookIdempotencyKey("company-1", payload)).toBe("stripe:company-1:evt_123");
    expect(paypalWebhookIdempotencyKey("company-1", payload)).toBe("paypal:company-1:evt_123");
  });

  it("returns queued outcome from BullMQ stripe dispatcher without processing inline", async () => {
    const enqueueSpy = vi.spyOn(enqueueModule, "enqueueBackgroundJob").mockResolvedValue({
      bullJobId: "job-1",
      metadataId: "meta-1",
    });

    const dispatcher = createStripeWebhookBullMqDispatcher();
    const result = await dispatcher.dispatch({
      companyId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      payload: JSON.stringify({ id: "evt_queued" }),
      headers: {},
      correlationId: "corr-1",
    });

    expect(result).toEqual({
      duplicate: false,
      outcome: "queued",
      paymentEventId: null,
      paymentId: null,
    });
    expect(enqueueSpy).toHaveBeenCalledOnce();

    enqueueSpy.mockRestore();
  });
});

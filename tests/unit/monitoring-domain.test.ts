import { describe, expect, it } from "vitest";

import {
  deriveApplicationHealthStatus,
  deriveWebhookHealthStatus,
} from "@/domain/monitoring/types";

describe("monitoring domain (TASK-100)", () => {
  it("derives webhook health from recent failures", () => {
    expect(
      deriveWebhookHealthStatus({
        supportsWebhooks: true,
        methodEnabled: true,
        recentWebhookFailures: 0,
      }),
    ).toBe("HEALTHY");
    expect(
      deriveWebhookHealthStatus({
        supportsWebhooks: true,
        methodEnabled: true,
        recentWebhookFailures: 2,
      }),
    ).toBe("DEGRADED");
    expect(
      deriveWebhookHealthStatus({
        supportsWebhooks: false,
        methodEnabled: true,
        recentWebhookFailures: 5,
      }),
    ).toBe("DISABLED");
  });

  it("derives application health from database connectivity", () => {
    expect(deriveApplicationHealthStatus({ database: true })).toBe("HEALTHY");
    expect(deriveApplicationHealthStatus({ database: false })).toBe("UNHEALTHY");
  });
});

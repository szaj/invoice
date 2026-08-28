import { describe, expect, it, vi } from "vitest";

import { scrubSentryEvent } from "@/lib/sentry/scrub";

vi.mock("@/server/monitoring/monitoring-service", () => ({
  getApplicationHealth: vi.fn(),
}));

import { getApplicationHealth } from "@/server/monitoring/monitoring-service";
import { GET } from "@/app/api/health/route";

describe("sentry scrubbing (TASK-100)", () => {
  it("redacts credential-like keys and secret values", () => {
    const scrubbed = scrubSentryEvent({
      type: undefined,
      message: "test",
      extra: {
        apiKey: "sk_test_should_not_leak",
        companyId: "company-1",
        nested: {
          webhookSecret: "whsec_test",
        },
      },
      request: {
        headers: {
          authorization: "Bearer secret-token",
          "content-type": "application/json",
        },
      },
    });

    expect(scrubbed?.extra).toEqual({
      apiKey: "[Redacted]",
      companyId: "company-1",
      nested: {
        webhookSecret: "[Redacted]",
      },
    });
    expect(scrubbed?.request?.headers).toEqual({
      authorization: "[Redacted]",
      "content-type": "application/json",
    });
  });
});

describe("health endpoint handler (TASK-100)", () => {
  it("returns 503 when database is unavailable", async () => {
    vi.mocked(getApplicationHealth).mockResolvedValue({
      status: "UNHEALTHY",
      database: false,
      queueConfigured: false,
      sentryConfigured: false,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.checks.database).toBe("error");
  });

  it("returns 200 when database is healthy", async () => {
    vi.mocked(getApplicationHealth).mockResolvedValue({
      status: "HEALTHY",
      database: true,
      queueConfigured: true,
      sentryConfigured: false,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.checks.database).toBe("ok");
  });
});

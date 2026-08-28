import { describe, expect, it } from "vitest";

import {
  isStagingSmokeHealthy,
  normalizeStagingSmokeBaseUrl,
  parseStagingHealthResponse,
} from "@/domain/ops/staging-smoke";

describe("staging smoke helpers (TASK-102)", () => {
  it("parses a healthy health-check payload", () => {
    const parsed = parseStagingHealthResponse({
      ok: true,
      status: "HEALTHY",
      checks: {
        database: "ok",
        queue: "configured",
        sentry: "disabled",
      },
    });

    expect(parsed).not.toBeNull();
    expect(isStagingSmokeHealthy(parsed!)).toBe(true);
  });

  it("rejects malformed health payloads", () => {
    expect(parseStagingHealthResponse(null)).toBeNull();
    expect(parseStagingHealthResponse({ ok: true })).toBeNull();
    expect(parseStagingHealthResponse({ ok: true, status: "HEALTHY", checks: 1 })).toBeNull();
  });

  it("treats UNHEALTHY status as a failed smoke check", () => {
    const parsed = parseStagingHealthResponse({ ok: false, status: "UNHEALTHY" });
    expect(parsed).not.toBeNull();
    expect(isStagingSmokeHealthy(parsed!)).toBe(false);
  });

  it("normalizes trailing slashes from the smoke base URL", () => {
    expect(normalizeStagingSmokeBaseUrl("https://uat.example.com/")).toBe(
      "https://uat.example.com",
    );
  });
});

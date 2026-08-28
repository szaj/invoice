import { describe, expect, it } from "vitest";

import {
  isStagingSmokeHealthy,
  normalizeStagingSmokeBaseUrl,
  parseStagingHealthResponse,
} from "@/domain/ops/staging-smoke";

const stagingSmokeUrl = process.env.STAGING_SMOKE_URL?.trim();

describe.skipIf(!stagingSmokeUrl)("staging UAT smoke (TASK-102)", () => {
  it("GET /api/health returns a healthy payload", async () => {
    const baseUrl = normalizeStagingSmokeBaseUrl(stagingSmokeUrl!);
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { Accept: "application/json" },
    });

    expect(response.status).toBe(200);

    const body: unknown = await response.json();
    const parsed = parseStagingHealthResponse(body);
    expect(parsed, "health JSON must match the public contract").not.toBeNull();
    expect(isStagingSmokeHealthy(parsed!)).toBe(true);
    expect(parsed!.checks?.database).toBe("ok");
  });

  it("GET /login is reachable for business UAT access", async () => {
    const baseUrl = normalizeStagingSmokeBaseUrl(stagingSmokeUrl!);
    const response = await fetch(`${baseUrl}/login`, {
      redirect: "manual",
    });

    expect([200, 307, 308]).toContain(response.status);
  });
});

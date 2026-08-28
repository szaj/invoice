import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  assessProductionDeploymentReadiness,
  isProductionSmokeHealthy,
  normalizeProductionSmokeBaseUrl,
  parseDotenvFile,
  parseProductionHealthResponse,
} from "@/domain/ops/production-smoke";

const productionSmokeUrl = process.env.PRODUCTION_SMOKE_URL?.trim();
const productionEnvPath = process.env.PRODUCTION_ENV_PATH?.trim();

describe.skipIf(!productionEnvPath)("production deployment checklist (TASK-103)", () => {
  it("production env file passes readiness assessment", () => {
    const content = readFileSync(productionEnvPath!, "utf8");
    const env = parseDotenvFile(content);
    const assessment = assessProductionDeploymentReadiness(env);

    expect(assessment.missingRequired, assessment.missingRequired.join(", ")).toEqual([]);
    expect(assessment.ready).toBe(true);
  });
});

describe.skipIf(!productionSmokeUrl)("production smoke (TASK-103)", () => {
  const baseUrl = normalizeProductionSmokeBaseUrl(productionSmokeUrl!);

  it("public URL uses HTTPS", () => {
    expect(baseUrl.startsWith("https://")).toBe(true);
  });

  it("GET /api/health returns a healthy payload", async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { Accept: "application/json" },
    });

    expect(response.status).toBe(200);

    const body: unknown = await response.json();
    const parsed = parseProductionHealthResponse(body);
    expect(parsed, "health JSON must match the public contract").not.toBeNull();
    expect(isProductionSmokeHealthy(parsed!)).toBe(true);
    expect(parsed!.checks?.database).toBe("ok");
    expect(parsed!.checks?.queue).toBe("configured");
  });

  it("GET /login is reachable for operator access", async () => {
    const response = await fetch(`${baseUrl}/login`, {
      redirect: "manual",
    });

    expect([200, 307, 308]).toContain(response.status);
  });
});

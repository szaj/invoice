import { afterAll, describe, expect, it } from "vitest";

import { getApplicationHealth } from "@/server/monitoring/monitoring-service";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("monitoring health integration (TASK-100)", () => {
  afterAll(async () => {
    const { getPrisma } = await import("@/server/db/client");
    await getPrisma().$disconnect();
  });

  it("pings the database for application health", async () => {
    const health = await getApplicationHealth();
    expect(health.database).toBe(true);
    expect(health.status).toBe("HEALTHY");
  });
});

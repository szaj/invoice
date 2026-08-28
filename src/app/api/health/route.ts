import { NextResponse } from "next/server";

import { getApplicationHealth } from "@/server/monitoring/monitoring-service";

export async function GET() {
  const health = await getApplicationHealth();
  const statusCode = health.status === "UNHEALTHY" ? 503 : 200;

  return NextResponse.json(
    {
      ok: health.status !== "UNHEALTHY",
      status: health.status,
      checks: {
        database: health.database ? "ok" : "error",
        queue: health.queueConfigured ? "configured" : "inline",
        sentry: health.sentryConfigured ? "configured" : "disabled",
      },
    },
    { status: statusCode },
  );
}

import * as Sentry from "@sentry/nextjs";

import { loadEnvFiles } from "../src/config/load-env-files";
import { captureServerException } from "../src/lib/sentry/capture";
import { buildSentryWorkerOptions } from "../src/lib/sentry/options";
import { startQueueWorkers } from "../src/server/queue/start-workers";

loadEnvFiles();

Sentry.init(buildSentryWorkerOptions() as Parameters<typeof Sentry.init>[0]);

let shutdown: (() => Promise<void>) | undefined;

async function main(): Promise<void> {
  shutdown = await startQueueWorkers();
}

function handleSignal(signal: string): void {
  void (async () => {
    console.log(`Received ${signal}, shutting down worker...`);
    if (shutdown) {
      await shutdown();
    }
    process.exit(0);
  })();
}

process.on("SIGINT", () => handleSignal("SIGINT"));
process.on("SIGTERM", () => handleSignal("SIGTERM"));

main().catch((error) => {
  void captureServerException(error, { tags: { boundary: "worker" } });
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

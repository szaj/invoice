import { logger } from "@/lib/logger";
import { requireRedisUrl } from "@/server/queue/config";
import { closeRedisConnection } from "@/server/queue/connection";
import { closeQueueWorkers, createQueueWorkers } from "@/server/queue/worker-processors";

export async function startQueueWorkers(): Promise<() => Promise<void>> {
  requireRedisUrl();
  const workers = createQueueWorkers();

  for (const worker of workers) {
    worker.on("ready", () => {
      logger.info(
        { event: "queue.worker_ready", queueName: worker.name },
        "Queue worker ready",
      );
    });
    worker.on("error", (error) => {
      logger.error(
        {
          event: "queue.worker_error",
          queueName: worker.name,
          err: error instanceof Error ? error.message : "unknown",
        },
        "Queue worker error",
      );
    });
  }

  logger.info({ event: "queue.workers_started", count: workers.length }, "Queue workers started");

  return async () => {
    await closeQueueWorkers(workers);
    await closeRedisConnection();
    logger.info({ event: "queue.workers_stopped" }, "Queue workers stopped");
  };
}

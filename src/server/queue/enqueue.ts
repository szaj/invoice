import { Queue } from "bullmq";

import { getDefaultJobOptions } from "@/server/queue/config";
import { getRedisConnection } from "@/server/queue/connection";
import { hashToBullJobId } from "@/server/queue/idempotency";
import { PrismaBackgroundJobStore } from "@/server/queue/job-metadata-repository";

const queueCache = new Map<string, Queue>();

export interface EnqueueJobOptions<TJob> {
  readonly queueName: string;
  readonly jobName: string;
  readonly job: TJob;
  readonly idempotencyKey?: string | null;
  readonly correlationId?: string | null;
  readonly companyId?: string | null;
  readonly entityType?: string | null;
  readonly entityId?: string | null;
}

function getQueue(queueName: string): Queue {
  const existing = queueCache.get(queueName);
  if (existing) {
    return existing;
  }

  const queue = new Queue(queueName, {
    connection: getRedisConnection(),
    defaultJobOptions: getDefaultJobOptions(),
  });
  queueCache.set(queueName, queue);
  return queue;
}

export async function enqueueBackgroundJob<TJob>(
  options: EnqueueJobOptions<TJob>,
  store: PrismaBackgroundJobStore = new PrismaBackgroundJobStore(),
): Promise<{ readonly bullJobId: string; readonly metadataId: string }> {
  if (options.idempotencyKey) {
    const existing = await store.findByIdempotencyKey(options.queueName, options.idempotencyKey);
    if (
      existing &&
      (existing.status === "QUEUED" ||
        existing.status === "ACTIVE" ||
        existing.status === "COMPLETED" ||
        existing.status === "DUPLICATE_SKIPPED")
    ) {
      return {
        bullJobId: existing.bullJobId ?? existing.id,
        metadataId: existing.id,
      };
    }
  }

  const metadata = await store.createQueued({
    queueName: options.queueName,
    jobName: options.jobName,
    idempotencyKey: options.idempotencyKey ?? null,
    correlationId: options.correlationId ?? null,
    companyId: options.companyId ?? null,
    entityType: options.entityType ?? null,
    entityId: options.entityId ?? null,
  });

  const jobId = options.idempotencyKey ? hashToBullJobId(options.idempotencyKey) : undefined;
  const queue = getQueue(options.queueName);
  const bullJob = await queue.add(options.jobName, options.job, { jobId });
  const bullJobId = bullJob.id ?? metadata.id;
  await store.attachBullJobId(metadata.id, bullJobId);

  return { bullJobId, metadataId: metadata.id };
}

export async function closeEnqueueQueues(): Promise<void> {
  await Promise.all([...queueCache.values()].map((queue) => queue.close()));
  queueCache.clear();
}

import { getEnv } from "@/config/env";

export const DEFAULT_QUEUE_ATTEMPTS = 5;

export const DEFAULT_QUEUE_BACKOFF_MS = 2_000;

export function isQueueEnabled(source?: { readonly REDIS_URL?: string }): boolean {
  const redisUrl = source?.REDIS_URL ?? getEnv().REDIS_URL;
  return typeof redisUrl === "string" && redisUrl.trim().length > 0;
}

export function requireRedisUrl(source?: { readonly REDIS_URL?: string }): string {
  const redisUrl = source?.REDIS_URL ?? getEnv().REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is required for BullMQ queue processing");
  }
  return redisUrl;
}

export function getDefaultJobOptions() {
  return {
    attempts: DEFAULT_QUEUE_ATTEMPTS,
    backoff: {
      type: "exponential" as const,
      delay: DEFAULT_QUEUE_BACKOFF_MS,
    },
    removeOnComplete: {
      count: 1_000,
    },
    removeOnFail: {
      count: 5_000,
    },
  };
}

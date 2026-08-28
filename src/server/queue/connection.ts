import IORedis from "ioredis";

import { requireRedisUrl } from "@/server/queue/config";

let sharedConnection: IORedis | undefined;

export function getRedisConnection(): IORedis {
  if (!sharedConnection) {
    sharedConnection = new IORedis(requireRedisUrl(), {
      maxRetriesPerRequest: null,
    });
  }
  return sharedConnection;
}

export async function closeRedisConnection(): Promise<void> {
  if (sharedConnection) {
    await sharedConnection.quit();
    sharedConnection = undefined;
  }
}

export function resetRedisConnectionForTests(): void {
  sharedConnection = undefined;
}

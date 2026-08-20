import "server-only";

import path from "node:path";

import { getEnv, type Env } from "@/config/env";
import { LocalDiskStorageService } from "@/server/storage/local-disk-storage";
import { S3CompatibleStorageService } from "@/server/storage/s3-compatible-storage";
import type { StorageService } from "@/server/storage/storage-service";

function hasR2Config(env: Env): boolean {
  return Boolean(
    env.R2_ENDPOINT && env.R2_BUCKET && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY,
  );
}

/**
 * Resolves the StorageService for the current environment.
 * Prefer Cloudflare R2 when configured; otherwise local disk in local/test only.
 */
export function createStorageService(env: Env = getEnv()): StorageService {
  if (hasR2Config(env)) {
    return new S3CompatibleStorageService({
      endpoint: env.R2_ENDPOINT!,
      region: "auto",
      bucket: env.R2_BUCKET!,
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    });
  }

  if (env.APP_ENV === "local" || env.NODE_ENV === "test") {
    return new LocalDiskStorageService(path.join(process.cwd(), ".data", "object-storage"));
  }

  throw new Error(
    "Object storage is not configured. Set R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
  );
}

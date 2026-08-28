import "server-only";

import { getEnv } from "@/config/env";
import {
  deriveDatabaseBackupHealth,
  deriveObjectStorageBackupHealth,
  hasObjectStorageConfig,
  parseBackupConfig,
  resolveObjectStorageProvider,
} from "@/domain/backup/policy";
import type { BackupHealthSnapshot } from "@/domain/backup/types";
import { readBackupSuccessMarker } from "@/ops/backup/marker";
import { getObjectStorageVersioningEnabled } from "@/ops/backup/object-storage-versioning";

export type BackupServiceDependencies = {
  readonly readMarker?: (backupDir: string) => Promise<ReturnType<typeof readBackupSuccessMarker>>;
  readonly readVersioning?: typeof getObjectStorageVersioningEnabled;
};

export async function getBackupHealthSnapshot(
  deps: BackupServiceDependencies = {},
): Promise<BackupHealthSnapshot> {
  const env = getEnv();
  const config = parseBackupConfig(env);
  const readMarker = deps.readMarker ?? readBackupSuccessMarker;
  const readVersioning = deps.readVersioning ?? getObjectStorageVersioningEnabled;

  const marker = config.backupDir != null ? await readMarker(config.backupDir) : null;

  const database = deriveDatabaseBackupHealth({
    appEnv: env.APP_ENV,
    config,
    marker,
  });

  const provider = resolveObjectStorageProvider(env);
  let versioningEnabled: boolean | null = null;
  if (hasObjectStorageConfig(env)) {
    versioningEnabled = await readVersioning({
      endpoint: env.R2_ENDPOINT!,
      bucket: env.R2_BUCKET!,
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    });
  }

  const objectStorage = deriveObjectStorageBackupHealth({
    appEnv: env.APP_ENV,
    provider,
    versioningEnabled,
  });

  return { database, objectStorage };
}

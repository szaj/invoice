import type { AppEnv } from "@/config/env-schema";
import {
  DEFAULT_BACKUP_MAX_AGE_HOURS,
  DEFAULT_BACKUP_RETENTION_DAYS,
  type BackupConfig,
  type BackupHealthStatus,
  type BackupSuccessMarker,
  type DatabaseBackupHealth,
  type ObjectStorageBackupHealth,
} from "@/domain/backup/types";

export type BackupEnvInput = {
  readonly APP_ENV: AppEnv;
  readonly BACKUP_DIR?: string | null;
  readonly BACKUP_RETENTION_DAYS?: string | number;
  readonly BACKUP_MAX_AGE_HOURS?: string | number;
  readonly BACKUP_RESTORE_ALLOW_PRODUCTION?: string;
  readonly R2_ENDPOINT?: string;
  readonly R2_BUCKET?: string;
  readonly R2_ACCESS_KEY_ID?: string;
  readonly R2_SECRET_ACCESS_KEY?: string;
};

function parsePositiveInt(value: string | number | undefined, fallback: number): number {
  if (value == null) {
    return fallback;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function parseBackupConfig(input: BackupEnvInput): BackupConfig {
  const backupDirRaw = input.BACKUP_DIR;
  const backupDir =
    typeof backupDirRaw === "string" && backupDirRaw.trim().length > 0
      ? backupDirRaw.trim()
      : null;
  return {
    backupDir,
    retentionDays: parsePositiveInt(input.BACKUP_RETENTION_DAYS, DEFAULT_BACKUP_RETENTION_DAYS),
    maxAgeHours: parsePositiveInt(input.BACKUP_MAX_AGE_HOURS, DEFAULT_BACKUP_MAX_AGE_HOURS),
    restoreAllowProduction: parseBooleanFlag(input.BACKUP_RESTORE_ALLOW_PRODUCTION),
  };
}

export function hasObjectStorageConfig(input: BackupEnvInput): boolean {
  return Boolean(
    input.R2_ENDPOINT && input.R2_BUCKET && input.R2_ACCESS_KEY_ID && input.R2_SECRET_ACCESS_KEY,
  );
}

export function resolveObjectStorageProvider(input: BackupEnvInput): "R2" | "LOCAL" | null {
  if (hasObjectStorageConfig(input)) {
    return "R2";
  }
  if (input.APP_ENV === "local") {
    return "LOCAL";
  }
  return null;
}

function hoursSince(isoTimestamp: string, now: Date = new Date()): number {
  const completedAt = Date.parse(isoTimestamp);
  if (!Number.isFinite(completedAt)) {
    return Number.POSITIVE_INFINITY;
  }
  return (now.getTime() - completedAt) / (60 * 60 * 1000);
}

export function deriveDatabaseBackupHealth(input: {
  readonly appEnv: AppEnv;
  readonly config: BackupConfig;
  readonly marker: BackupSuccessMarker | null;
  readonly now?: Date;
}): DatabaseBackupHealth {
  const configured = input.config.backupDir != null;
  const pitrRecommended = input.appEnv === "production";

  if (!configured) {
    return {
      status: input.appEnv === "production" ? "UNHEALTHY" : "DISABLED",
      configured: false,
      lastSuccessAt: null,
      lastArtifactName: null,
      retentionDays: input.config.retentionDays,
      maxAgeHours: input.config.maxAgeHours,
      pitrRecommended,
      managedProvider: "SUPABASE",
    };
  }

  if (!input.marker) {
    return {
      status: "UNHEALTHY",
      configured: true,
      lastSuccessAt: null,
      lastArtifactName: null,
      retentionDays: input.config.retentionDays,
      maxAgeHours: input.config.maxAgeHours,
      pitrRecommended,
      managedProvider: "SUPABASE",
    };
  }

  const ageHours = hoursSince(input.marker.completedAt, input.now);
  let status: BackupHealthStatus = "HEALTHY";
  if (ageHours > input.config.maxAgeHours) {
    status = "UNHEALTHY";
  } else if (ageHours > 24) {
    status = "DEGRADED";
  }

  return {
    status,
    configured: true,
    lastSuccessAt: input.marker.completedAt,
    lastArtifactName: input.marker.artifactName,
    retentionDays: input.config.retentionDays,
    maxAgeHours: input.config.maxAgeHours,
    pitrRecommended,
    managedProvider: "SUPABASE",
  };
}

export function deriveObjectStorageBackupHealth(input: {
  readonly appEnv: AppEnv;
  readonly provider: "R2" | "LOCAL" | null;
  readonly versioningEnabled: boolean | null;
}): ObjectStorageBackupHealth {
  const versioningRequired = input.appEnv === "production" || input.appEnv === "staging";

  if (!input.provider) {
    return {
      status: versioningRequired ? "UNHEALTHY" : "DISABLED",
      configured: false,
      provider: null,
      versioningEnabled: null,
      versioningRequired,
    };
  }

  if (input.provider === "LOCAL") {
    return {
      status: versioningRequired ? "DEGRADED" : "DISABLED",
      configured: true,
      provider: "LOCAL",
      versioningEnabled: false,
      versioningRequired,
    };
  }

  if (input.versioningEnabled == null) {
    return {
      status: versioningRequired ? "DEGRADED" : "DISABLED",
      configured: true,
      provider: "R2",
      versioningEnabled: null,
      versioningRequired,
    };
  }

  const status: BackupHealthStatus =
    versioningRequired && !input.versioningEnabled ? "UNHEALTHY" : "HEALTHY";

  return {
    status,
    configured: true,
    provider: "R2",
    versioningEnabled: input.versioningEnabled,
    versioningRequired,
  };
}

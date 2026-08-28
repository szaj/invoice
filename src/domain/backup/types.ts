export const BACKUP_HEALTH_STATUSES = ["HEALTHY", "DEGRADED", "DISABLED", "UNHEALTHY"] as const;
export type BackupHealthStatus = (typeof BACKUP_HEALTH_STATUSES)[number];

/** Minimum daily backup cadence for operational health checks. */
export const DEFAULT_BACKUP_MAX_AGE_HOURS = 26;

/** Default on-disk retention for application-managed database dumps. */
export const DEFAULT_BACKUP_RETENTION_DAYS = 30;

export type BackupConfig = {
  readonly backupDir: string | null;
  readonly retentionDays: number;
  readonly maxAgeHours: number;
  readonly restoreAllowProduction: boolean;
};

export type BackupSuccessMarker = {
  readonly completedAt: string;
  readonly artifactName: string;
  readonly sizeBytes: number;
  readonly databaseUrlHost: string | null;
};

export type DatabaseBackupHealth = {
  readonly status: BackupHealthStatus;
  readonly configured: boolean;
  readonly lastSuccessAt: string | null;
  readonly lastArtifactName: string | null;
  readonly retentionDays: number;
  readonly maxAgeHours: number;
  readonly pitrRecommended: boolean;
  readonly managedProvider: "SUPABASE" | "UNKNOWN";
};

export type ObjectStorageBackupHealth = {
  readonly status: BackupHealthStatus;
  readonly configured: boolean;
  readonly provider: "R2" | "LOCAL" | null;
  readonly versioningEnabled: boolean | null;
  readonly versioningRequired: boolean;
};

export type BackupHealthSnapshot = {
  readonly database: DatabaseBackupHealth;
  readonly objectStorage: ObjectStorageBackupHealth;
};

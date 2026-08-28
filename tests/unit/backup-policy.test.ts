import { describe, expect, it } from "vitest";

import {
  deriveDatabaseBackupHealth,
  deriveObjectStorageBackupHealth,
  parseBackupConfig,
} from "@/domain/backup/policy";

describe("backup policy (TASK-101)", () => {
  it("parses backup configuration with defaults", () => {
    const config = parseBackupConfig({ APP_ENV: "staging" });
    expect(config).toEqual({
      backupDir: null,
      retentionDays: 30,
      maxAgeHours: 26,
      restoreAllowProduction: false,
    });
  });

  it("marks database backups unhealthy when production lacks recent success", () => {
    const config = parseBackupConfig({
      APP_ENV: "production",
      BACKUP_DIR: "/var/backups/invoices",
    });

    const health = deriveDatabaseBackupHealth({
      appEnv: "production",
      config,
      marker: null,
    });

    expect(health.status).toBe("UNHEALTHY");
    expect(health.pitrRecommended).toBe(true);
  });

  it("derives degraded database health when the last dump is older than 24 hours", () => {
    const config = parseBackupConfig({
      APP_ENV: "staging",
      BACKUP_DIR: "/var/backups/invoices",
    });
    const now = new Date("2026-08-28T12:00:00.000Z");

    const health = deriveDatabaseBackupHealth({
      appEnv: "staging",
      config,
      marker: {
        completedAt: "2026-08-27T10:00:00.000Z",
        artifactName: "database-2026-08-27.sql.gz",
        sizeBytes: 1024,
        databaseUrlHost: "db.example.com",
      },
      now,
    });

    expect(health.status).toBe("DEGRADED");
  });

  it("requires R2 versioning in staging and production", () => {
    expect(
      deriveObjectStorageBackupHealth({
        appEnv: "production",
        provider: "R2",
        versioningEnabled: false,
      }).status,
    ).toBe("UNHEALTHY");

    expect(
      deriveObjectStorageBackupHealth({
        appEnv: "production",
        provider: "R2",
        versioningEnabled: true,
      }).status,
    ).toBe("HEALTHY");
  });
});

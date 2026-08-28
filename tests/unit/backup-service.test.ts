import { describe, expect, it, vi } from "vitest";

import { getBackupHealthSnapshot } from "@/server/backup/backup-service";

vi.mock("@/config/env", () => ({
  getEnv: vi.fn(() => ({
    APP_ENV: "staging",
    BACKUP_DIR: "/var/backups/invoices",
    BACKUP_RETENTION_DAYS: 30,
    BACKUP_MAX_AGE_HOURS: 26,
    BACKUP_RESTORE_ALLOW_PRODUCTION: undefined,
    R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
    R2_BUCKET: "invoices",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
  })),
}));

describe("backup service (TASK-101)", () => {
  it("aggregates database marker and object storage versioning", async () => {
    const snapshot = await getBackupHealthSnapshot({
      readMarker: vi.fn().mockResolvedValue({
        completedAt: "2026-08-28T06:00:00.000Z",
        artifactName: "database-2026-08-28.sql.gz",
        sizeBytes: 4096,
        databaseUrlHost: "db.example.com",
      }),
      readVersioning: vi.fn().mockResolvedValue(true),
    });

    expect(snapshot.database.configured).toBe(true);
    expect(snapshot.database.lastArtifactName).toBe("database-2026-08-28.sql.gz");
    expect(snapshot.objectStorage.versioningEnabled).toBe(true);
    expect(snapshot.objectStorage.status).toBe("HEALTHY");
  });
});

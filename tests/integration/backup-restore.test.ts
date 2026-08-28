import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { parseBackupConfig } from "@/domain/backup/policy";
import { assertRestoreAllowed } from "@/domain/backup/restore-guard";
import { assertBackupDirectorySafe, runDatabaseRestore } from "@/ops/backup/database-backup";
import { readBackupSuccessMarker, writeBackupSuccessMarker } from "@/ops/backup/marker";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe("backup marker IO (TASK-101)", () => {
  let tempDir: string;

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("writes and reads the last-success marker", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "invoices-backup-"));
    await writeBackupSuccessMarker(tempDir, {
      completedAt: "2026-08-28T06:00:00.000Z",
      artifactName: "database-2026-08-28.sql.gz",
      sizeBytes: 2048,
      databaseUrlHost: "db.example.com",
    });

    const marker = await readBackupSuccessMarker(tempDir);
    expect(marker?.artifactName).toBe("database-2026-08-28.sql.gz");
  });
});

describe("backup restore procedure (TASK-101)", () => {
  it("documents non-production restore guardrails", () => {
    const config = parseBackupConfig({
      APP_ENV: "staging",
      BACKUP_DIR: "/var/backups/invoices",
    });

    expect(config.restoreAllowProduction).toBe(false);
    expect(
      assertRestoreAllowed({
        appEnv: "staging",
        restoreAllowProduction: config.restoreAllowProduction,
        artifactPath: "/var/backups/invoices/database-2026-08-28.sql.gz",
      }).ok,
    ).toBe(true);
  });

  it("rejects unsafe backup directories", () => {
    expect(assertBackupDirectorySafe("/var/backups/.env.local")).toMatch(/secret/i);
  });
});

describe.skipIf(!runDbIntegration)("backup restore integration (TASK-101)", () => {
  let tempDir: string;

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("refuses restore when the artifact is missing", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "invoices-restore-"));
    const missingArtifact = path.join(tempDir, "database-missing.sql.gz");

    const result = await runDatabaseRestore({
      databaseUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
      artifactPath: missingArtifact,
      appEnv: "staging",
      restoreAllowProduction: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/does not exist/i);
    }
  });

  it("validates restore guard before touching the database", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "invoices-restore-"));
    const artifactPath = path.join(tempDir, "database-placeholder.sql.gz");
    await mkdir(tempDir, { recursive: true });
    await writeFile(artifactPath, "placeholder");

    const result = await runDatabaseRestore({
      databaseUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
      artifactPath: path.join(tempDir, ".env"),
      appEnv: "production",
      restoreAllowProduction: false,
    });

    expect(result.ok).toBe(false);
  });
});

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

import { assertRestoreAllowed } from "@/domain/backup/restore-guard";
import type { BackupConfig } from "@/domain/backup/types";
import {
  extractDatabaseUrlHost,
  formatBackupArtifactName,
  writeBackupSuccessMarker,
} from "@/ops/backup/marker";

const SECRET_FILENAME_PATTERN = /(?:^|[\\/]).env(?:\.|$)/i;

export type DatabaseBackupInput = {
  readonly databaseUrl: string;
  readonly config: BackupConfig;
  readonly now?: Date;
};

export type DatabaseBackupResult =
  | {
      readonly ok: true;
      readonly artifactPath: string;
      readonly sizeBytes: number;
    }
  | { readonly ok: false; readonly error: string };

export type DatabaseRestoreInput = {
  readonly databaseUrl: string;
  readonly artifactPath: string;
  readonly appEnv: "local" | "development" | "staging" | "production";
  readonly restoreAllowProduction: boolean;
};

export type DatabaseRestoreResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

export function assertBackupDirectorySafe(backupDir: string): string | null {
  if (SECRET_FILENAME_PATTERN.test(backupDir)) {
    return "BACKUP_DIR must not reference environment or secret files.";
  }
  return null;
}

export async function pruneExpiredBackups(
  backupDir: string,
  retentionDays: number,
  now: Date = new Date(),
): Promise<void> {
  const entries = await readdir(backupDir);
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.startsWith("database-") || !entry.endsWith(".sql.gz")) {
        return;
      }
      const fullPath = path.join(backupDir, entry);
      const fileStat = await stat(fullPath);
      if (fileStat.mtimeMs < cutoff) {
        await unlink(fullPath);
      }
    }),
  );
}

export async function runDatabaseBackup(input: DatabaseBackupInput): Promise<DatabaseBackupResult> {
  const backupDir = input.config.backupDir;
  if (!backupDir) {
    return { ok: false, error: "BACKUP_DIR is not configured." };
  }

  const dirError = assertBackupDirectorySafe(backupDir);
  if (dirError) {
    return { ok: false, error: dirError };
  }

  await mkdir(backupDir, { recursive: true });

  const artifactName = formatBackupArtifactName(input.now);
  const artifactPath = path.join(backupDir, artifactName);

  const dumpWithOutput = spawn(
    "pg_dump",
    ["--dbname", input.databaseUrl, "--format=plain", "--no-owner", "--no-privileges"],
    {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  let stderr = "";
  dumpWithOutput.stderr?.on("data", (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });

  try {
    await pipeline(dumpWithOutput.stdout!, createGzip(), createWriteStream(artifactPath));
    const exitCode = await new Promise<number>((resolve, reject) => {
      dumpWithOutput.on("error", reject);
      dumpWithOutput.on("close", (code) => resolve(code ?? 1));
    });
    if (exitCode !== 0) {
      await unlink(artifactPath).catch(() => undefined);
      return {
        ok: false,
        error: stderr.trim() || "pg_dump failed. Ensure PostgreSQL client tools are installed.",
      };
    }
  } catch (error) {
    await unlink(artifactPath).catch(() => undefined);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to write backup artifact.",
    };
  }

  const fileStat = await stat(artifactPath);
  await writeBackupSuccessMarker(backupDir, {
    completedAt: (input.now ?? new Date()).toISOString(),
    artifactName,
    sizeBytes: fileStat.size,
    databaseUrlHost: extractDatabaseUrlHost(input.databaseUrl),
  });
  await pruneExpiredBackups(backupDir, input.config.retentionDays, input.now);

  return {
    ok: true,
    artifactPath,
    sizeBytes: fileStat.size,
  };
}

export async function runDatabaseRestore(input: DatabaseRestoreInput): Promise<DatabaseRestoreResult> {
  const guard = assertRestoreAllowed({
    appEnv: input.appEnv,
    restoreAllowProduction: input.restoreAllowProduction,
    artifactPath: input.artifactPath,
  });
  if (!guard.ok) {
    return { ok: false, error: guard.reason };
  }

  try {
    await stat(input.artifactPath);
  } catch {
    return { ok: false, error: "Backup artifact does not exist." };
  }

  const gunzipRestore = spawn(
    "psql",
    ["--dbname", input.databaseUrl, "--set", "ON_ERROR_STOP=1", "--file", "-"],
    {
      stdio: ["pipe", "ignore", "pipe"],
      windowsHide: true,
      shell: process.platform === "win32",
    },
  );

  const source = spawn("gzip", ["-dc", input.artifactPath], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: process.platform === "win32",
  });

  let stderr = "";
  source.stderr?.on("data", (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });
  gunzipRestore.stderr?.on("data", (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });

  source.stdout?.pipe(gunzipRestore.stdin!);

  const [sourceCode, restoreCode] = await Promise.all([
    new Promise<number>((resolve, reject) => {
      source.on("error", reject);
      source.on("close", (code) => resolve(code ?? 1));
    }),
    new Promise<number>((resolve, reject) => {
      gunzipRestore.on("error", reject);
      gunzipRestore.on("close", (code) => resolve(code ?? 1));
    }),
  ]);

  if (sourceCode !== 0 || restoreCode !== 0) {
    return {
      ok: false,
      error:
        stderr.trim() ||
        "Database restore failed. Ensure PostgreSQL client tools (psql, gzip) are installed.",
    };
  }

  return { ok: true };
}

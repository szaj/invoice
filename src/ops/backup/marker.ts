import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { BackupSuccessMarker } from "@/domain/backup/types";

export const BACKUP_MARKER_FILENAME = ".last-success.json";

export function resolveBackupMarkerPath(backupDir: string): string {
  return path.join(backupDir, BACKUP_MARKER_FILENAME);
}

export async function readBackupSuccessMarker(
  backupDir: string,
): Promise<BackupSuccessMarker | null> {
  try {
    const raw = await readFile(resolveBackupMarkerPath(backupDir), "utf8");
    const parsed = JSON.parse(raw) as Partial<BackupSuccessMarker>;
    if (
      typeof parsed.completedAt !== "string" ||
      typeof parsed.artifactName !== "string" ||
      typeof parsed.sizeBytes !== "number"
    ) {
      return null;
    }
    return {
      completedAt: parsed.completedAt,
      artifactName: parsed.artifactName,
      sizeBytes: parsed.sizeBytes,
      databaseUrlHost:
        typeof parsed.databaseUrlHost === "string" ? parsed.databaseUrlHost : null,
    };
  } catch {
    return null;
  }
}

export async function writeBackupSuccessMarker(
  backupDir: string,
  marker: BackupSuccessMarker,
): Promise<void> {
  await mkdir(backupDir, { recursive: true });
  const target = resolveBackupMarkerPath(backupDir);
  const temp = `${target}.tmp`;
  await writeFile(temp, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
  await rename(temp, target);
}

export function formatBackupArtifactName(completedAt: Date = new Date()): string {
  const stamp = completedAt.toISOString().replace(/[:.]/g, "-");
  return `database-${stamp}.sql.gz`;
}

export function extractDatabaseUrlHost(databaseUrl: string): string | null {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return null;
  }
}

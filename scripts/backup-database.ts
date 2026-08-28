import { loadEnvFiles } from "../src/config/load-env-files";
import { requireDirectDatabaseUrl } from "../src/config/env";
import { parseBackupConfig } from "../src/domain/backup/policy";
import { runDatabaseBackup } from "../src/ops/backup/database-backup";

loadEnvFiles();

async function main(): Promise<void> {
  const env = process.env;
  const config = parseBackupConfig({
    APP_ENV: (env.APP_ENV as "local" | "development" | "staging" | "production") ?? "local",
    BACKUP_DIR: env.BACKUP_DIR,
    BACKUP_RETENTION_DAYS: env.BACKUP_RETENTION_DAYS,
    BACKUP_MAX_AGE_HOURS: env.BACKUP_MAX_AGE_HOURS,
    BACKUP_RESTORE_ALLOW_PRODUCTION: env.BACKUP_RESTORE_ALLOW_PRODUCTION,
  });

  const databaseUrl = requireDirectDatabaseUrl();
  const result = await runDatabaseBackup({ databaseUrl, config });

  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }

  console.log(
    `Database backup completed: ${result.artifactPath} (${result.sizeBytes.toLocaleString()} bytes)`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

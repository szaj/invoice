import { loadEnvFiles } from "../src/config/load-env-files";
import { requireDirectDatabaseUrl } from "../src/config/env";
import { parseBackupConfig } from "../src/domain/backup/policy";
import { runDatabaseRestore } from "../src/ops/backup/database-backup";

loadEnvFiles();

async function main(): Promise<void> {
  const artifactPath = process.argv[2];
  if (!artifactPath) {
    console.error("Usage: pnpm restore:database <path-to-database-*.sql.gz>");
    process.exit(1);
  }

  const env = process.env;
  const appEnv = (env.APP_ENV as "local" | "development" | "staging" | "production") ?? "local";
  const config = parseBackupConfig({
    APP_ENV: appEnv,
    BACKUP_DIR: env.BACKUP_DIR,
    BACKUP_RETENTION_DAYS: env.BACKUP_RETENTION_DAYS,
    BACKUP_MAX_AGE_HOURS: env.BACKUP_MAX_AGE_HOURS,
    BACKUP_RESTORE_ALLOW_PRODUCTION: env.BACKUP_RESTORE_ALLOW_PRODUCTION,
  });

  const databaseUrl = requireDirectDatabaseUrl();
  const result = await runDatabaseRestore({
    databaseUrl,
    artifactPath,
    appEnv,
    restoreAllowProduction: config.restoreAllowProduction,
  });

  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }

  console.log(`Database restore completed from ${artifactPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

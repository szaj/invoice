import type { AppEnv } from "@/config/env-schema";

export type RestoreGuardInput = {
  readonly appEnv: AppEnv;
  readonly restoreAllowProduction: boolean;
  readonly artifactPath: string;
};

export type RestoreGuardResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

const SECRET_FILENAME_PATTERN = /(?:^|[\\/]).env(?:\.|$)/i;

export function assertRestoreAllowed(input: RestoreGuardInput): RestoreGuardResult {
  if (SECRET_FILENAME_PATTERN.test(input.artifactPath)) {
    return {
      ok: false,
      reason: "Refusing to restore from an environment or secret file. Use a pg_dump artifact only.",
    };
  }

  if (input.appEnv === "production" && !input.restoreAllowProduction) {
    return {
      ok: false,
      reason:
        "Database restore is blocked in production. Enable Supabase PITR or set BACKUP_RESTORE_ALLOW_PRODUCTION=true for a controlled emergency restore.",
    };
  }

  return { ok: true };
}

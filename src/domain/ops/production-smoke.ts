import { blankToUndefined } from "@/config/env-schema";
import {
  isStagingSmokeHealthy,
  normalizeStagingSmokeBaseUrl,
  parseStagingHealthResponse,
  type StagingHealthResponse,
} from "@/domain/ops/staging-smoke";

export type ProductionHealthResponse = StagingHealthResponse;

/** Server-side env keys required before production cutover. */
export const PRODUCTION_REQUIRED_ENV_KEYS = [
  "APP_ENV",
  "APP_URL",
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_ENDPOINT",
  "REDIS_URL",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "GATEWAY_CREDENTIALS_KEY_VERSION",
  "GATEWAY_CREDENTIALS_KEY_V1",
  "BACKUP_DIR",
] as const;

/** Recommended but optional for production monitoring. */
export const PRODUCTION_RECOMMENDED_ENV_KEYS = ["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"] as const;

export interface ProductionDeploymentAssessment {
  readonly ready: boolean;
  readonly missingRequired: string[];
  readonly warnings: string[];
}

export function parseProductionHealthResponse(body: unknown): ProductionHealthResponse | null {
  return parseStagingHealthResponse(body);
}

export function isProductionSmokeHealthy(response: ProductionHealthResponse): boolean {
  return isStagingSmokeHealthy(response);
}

export function normalizeProductionSmokeBaseUrl(baseUrl: string): string {
  return normalizeStagingSmokeBaseUrl(baseUrl);
}

function readEnvValue(
  source: Readonly<Record<string, string | undefined>>,
  key: string,
): string | undefined {
  return blankToUndefined(source[key]);
}

/**
 * Operator checklist for production env files (deploy/production/env).
 * Does not validate secret correctness — only presence and APP_ENV / HTTPS policy.
 */
export function assessProductionDeploymentReadiness(
  source: Readonly<Record<string, string | undefined>>,
): ProductionDeploymentAssessment {
  const missingRequired: string[] = [];
  const warnings: string[] = [];

  for (const key of PRODUCTION_REQUIRED_ENV_KEYS) {
    if (!readEnvValue(source, key)) {
      missingRequired.push(key);
    }
  }

  const appEnv = readEnvValue(source, "APP_ENV");
  if (appEnv && appEnv !== "production") {
    missingRequired.push("APP_ENV must be production");
  }

  const appUrl = readEnvValue(source, "APP_URL");
  if (appUrl && !appUrl.startsWith("https://")) {
    missingRequired.push("APP_URL must use https:// in production");
  }

  for (const key of PRODUCTION_RECOMMENDED_ENV_KEYS) {
    if (!readEnvValue(source, key)) {
      warnings.push(`${key} is not configured (monitoring recommended)`);
    }
  }

  const uniqueMissing = [...new Set(missingRequired)];

  return {
    ready: uniqueMissing.length === 0,
    missingRequired: uniqueMissing,
    warnings,
  };
}

/**
 * Parse a dotenv-style file (KEY=value, no export prefix) for checklist assessment.
 */
export function parseDotenvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

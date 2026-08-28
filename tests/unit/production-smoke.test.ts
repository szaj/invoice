import { describe, expect, it } from "vitest";

import {
  assessProductionDeploymentReadiness,
  isProductionSmokeHealthy,
  normalizeProductionSmokeBaseUrl,
  parseDotenvFile,
  parseProductionHealthResponse,
  PRODUCTION_REQUIRED_ENV_KEYS,
} from "@/domain/ops/production-smoke";

describe("production smoke helpers (TASK-103)", () => {
  it("parses a healthy health-check payload", () => {
    const parsed = parseProductionHealthResponse({
      ok: true,
      status: "HEALTHY",
      checks: {
        database: "ok",
        queue: "configured",
        sentry: "configured",
      },
    });

    expect(parsed).not.toBeNull();
    expect(isProductionSmokeHealthy(parsed!)).toBe(true);
  });

  it("rejects malformed health payloads", () => {
    expect(parseProductionHealthResponse(null)).toBeNull();
    expect(parseProductionHealthResponse({ ok: true })).toBeNull();
  });

  it("normalizes trailing slashes from the smoke base URL", () => {
    expect(normalizeProductionSmokeBaseUrl("https://app.example.com/")).toBe(
      "https://app.example.com",
    );
  });

  it("assesses a complete production env as ready", () => {
    const env: Record<string, string> = {
      APP_ENV: "production",
      APP_URL: "https://app.example.com",
      DATABASE_URL: "postgresql://user:pass@host:5432/db",
      DIRECT_URL: "postgresql://user:pass@host:5432/db",
      NEXT_PUBLIC_SUPABASE_URL: "https://prod.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      R2_ACCOUNT_ID: "account",
      R2_ACCESS_KEY_ID: "access",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_BUCKET: "invoices-production",
      R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      REDIS_URL: "redis://redis:6379",
      RESEND_API_KEY: "resend",
      EMAIL_FROM: "billing@example.com",
      GATEWAY_CREDENTIALS_KEY_VERSION: "1",
      GATEWAY_CREDENTIALS_KEY_V1: "kek",
      BACKUP_DIR: "/var/backups/invoices",
      SENTRY_DSN: "https://sentry.example/1",
      NEXT_PUBLIC_SENTRY_DSN: "https://sentry.example/1",
    };

    const assessment = assessProductionDeploymentReadiness(env);
    expect(assessment.ready).toBe(true);
    expect(assessment.missingRequired).toEqual([]);
    expect(assessment.warnings).toEqual([]);
  });

  it("flags missing required keys and non-production APP_ENV", () => {
    const assessment = assessProductionDeploymentReadiness({
      APP_ENV: "staging",
      APP_URL: "http://app.example.com",
    });

    expect(assessment.ready).toBe(false);
    expect(assessment.missingRequired).toContain("APP_ENV must be production");
    expect(assessment.missingRequired).toContain("APP_URL must use https:// in production");
    expect(assessment.missingRequired.length).toBeGreaterThanOrEqual(
      PRODUCTION_REQUIRED_ENV_KEYS.length,
    );
  });

  it("warns when Sentry is not configured", () => {
    const env: Record<string, string> = {
      APP_ENV: "production",
      APP_URL: "https://app.example.com",
      DATABASE_URL: "postgresql://user:pass@host:5432/db",
      DIRECT_URL: "postgresql://user:pass@host:5432/db",
      NEXT_PUBLIC_SUPABASE_URL: "https://prod.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      R2_ACCOUNT_ID: "account",
      R2_ACCESS_KEY_ID: "access",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_BUCKET: "invoices-production",
      R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      REDIS_URL: "redis://redis:6379",
      RESEND_API_KEY: "resend",
      EMAIL_FROM: "billing@example.com",
      GATEWAY_CREDENTIALS_KEY_VERSION: "1",
      GATEWAY_CREDENTIALS_KEY_V1: "kek",
      BACKUP_DIR: "/var/backups/invoices",
    };

    const assessment = assessProductionDeploymentReadiness(env);
    expect(assessment.ready).toBe(true);
    expect(assessment.warnings.length).toBe(2);
  });

  it("parses dotenv files for checklist assessment", () => {
    const parsed = parseDotenvFile(`
# comment
APP_ENV=production
APP_URL="https://app.example.com"
    `);

    expect(parsed.APP_ENV).toBe("production");
    expect(parsed.APP_URL).toBe("https://app.example.com");
  });
});

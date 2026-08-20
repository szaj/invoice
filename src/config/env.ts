import "server-only";

import { z } from "zod";

import {
  blankToUndefined,
  envSchema,
  parseSupabasePublicConfig,
  type Env,
  type EnvSource,
  type SupabasePublicConfig,
} from "@/config/env-schema";
import { getApplicationBaseUrl } from "@/domain/auth/redirect";

export {
  envSchema,
  PUBLIC_ENV_KEYS,
  publicEnvSchema,
  SERVER_SECRET_ENV_KEYS,
  serverEnvSchema,
  type AppEnv,
  type Env,
  type EnvSource,
  type PublicEnv,
  type ServerEnv,
  type SupabasePublicConfig,
} from "@/config/env-schema";

function readEnvInput(source: EnvSource) {
  return {
    NODE_ENV: blankToUndefined(source.NODE_ENV),
    APP_ENV: blankToUndefined(source.APP_ENV),
    APP_URL: blankToUndefined(source.APP_URL),
    DATABASE_URL: blankToUndefined(source.DATABASE_URL),
    DIRECT_URL: blankToUndefined(source.DIRECT_URL),
    NEXT_PUBLIC_SUPABASE_URL: blankToUndefined(source.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: blankToUndefined(source.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: blankToUndefined(source.SUPABASE_SERVICE_ROLE_KEY),
    R2_ACCOUNT_ID: blankToUndefined(source.R2_ACCOUNT_ID),
    R2_ACCESS_KEY_ID: blankToUndefined(source.R2_ACCESS_KEY_ID),
    R2_SECRET_ACCESS_KEY: blankToUndefined(source.R2_SECRET_ACCESS_KEY),
    R2_BUCKET: blankToUndefined(source.R2_BUCKET),
    R2_ENDPOINT: blankToUndefined(source.R2_ENDPOINT),
    REDIS_URL: blankToUndefined(source.REDIS_URL),
    RESEND_API_KEY: blankToUndefined(source.RESEND_API_KEY),
    EMAIL_FROM: blankToUndefined(source.EMAIL_FROM),
    SENTRY_DSN: blankToUndefined(source.SENTRY_DSN),
    NEXT_PUBLIC_SENTRY_DSN: blankToUndefined(source.NEXT_PUBLIC_SENTRY_DSN),
    STRIPE_SECRET_KEY: blankToUndefined(source.STRIPE_SECRET_KEY),
    STRIPE_PUBLISHABLE_KEY: blankToUndefined(source.STRIPE_PUBLISHABLE_KEY),
    STRIPE_WEBHOOK_SECRET: blankToUndefined(source.STRIPE_WEBHOOK_SECRET),
    PAYPAL_CLIENT_ID: blankToUndefined(source.PAYPAL_CLIENT_ID),
    PAYPAL_CLIENT_SECRET: blankToUndefined(source.PAYPAL_CLIENT_SECRET),
    PAYPAL_WEBHOOK_ID: blankToUndefined(source.PAYPAL_WEBHOOK_ID),
    BANK_PROCESSOR_API_KEY: blankToUndefined(source.BANK_PROCESSOR_API_KEY),
    BANK_PROCESSOR_WEBHOOK_SECRET: blankToUndefined(source.BANK_PROCESSOR_WEBHOOK_SECRET),
  };
}

export function loadEnv(source: EnvSource = process.env): Env {
  const result = envSchema.safeParse(readEnvInput(source));

  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${z.prettifyError(result.error)}`);
  }

  return result.data;
}

let cachedEnv: Env | undefined;

export function getEnv(): Env {
  cachedEnv ??= loadEnv();
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = undefined;
}

export function requireRuntimeDatabaseUrl(env: Env = getEnv()): string {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for application database access");
  }

  return env.DATABASE_URL;
}

export function requireDirectDatabaseUrl(env: Env = getEnv()): string {
  const url = env.DIRECT_URL ?? env.DATABASE_URL;

  if (!url) {
    throw new Error("DIRECT_URL (or DATABASE_URL) is required for Prisma CLI migrations");
  }

  return url;
}

export function requireSupabasePublicConfig(env: Env = getEnv()): SupabasePublicConfig {
  return parseSupabasePublicConfig(env);
}

export function requireSupabaseServiceRoleKey(env: Env = getEnv()): string {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Admin user provisioning");
  }

  return env.SUPABASE_SERVICE_ROLE_KEY;
}

export function requireApplicationBaseUrl(env: Env = getEnv()): string {
  return getApplicationBaseUrl({
    appUrl: env.APP_URL,
    appEnv: env.APP_ENV,
  });
}

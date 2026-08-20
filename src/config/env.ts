import "server-only";

import { z } from "zod";

const appEnvSchema = z.enum(["local", "development", "staging", "production"]);
const nodeEnvSchema = z.enum(["development", "test", "production"]);

function blankToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

const optionalSecret = z.string().min(1).optional();
const optionalUrl = z.url().optional();
const optionalEmail = z.email().optional();

const envSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  APP_ENV: appEnvSchema.default("local"),

  DATABASE_URL: optionalSecret,
  DIRECT_URL: optionalSecret,

  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalSecret,
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret,

  R2_ACCOUNT_ID: optionalSecret,
  R2_ACCESS_KEY_ID: optionalSecret,
  R2_SECRET_ACCESS_KEY: optionalSecret,
  R2_BUCKET: optionalSecret,
  R2_ENDPOINT: optionalUrl,

  REDIS_URL: optionalSecret,

  RESEND_API_KEY: optionalSecret,
  EMAIL_FROM: optionalEmail,

  SENTRY_DSN: optionalUrl,
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,

  STRIPE_SECRET_KEY: optionalSecret,
  STRIPE_PUBLISHABLE_KEY: optionalSecret,
  STRIPE_WEBHOOK_SECRET: optionalSecret,
  PAYPAL_CLIENT_ID: optionalSecret,
  PAYPAL_CLIENT_SECRET: optionalSecret,
  PAYPAL_WEBHOOK_ID: optionalSecret,
  BANK_PROCESSOR_API_KEY: optionalSecret,
  BANK_PROCESSOR_WEBHOOK_SECRET: optionalSecret,
});

export type Env = z.infer<typeof envSchema>;
export type AppEnv = z.infer<typeof appEnvSchema>;

export interface EnvSource {
  readonly [key: string]: string | undefined;
}

function readEnvInput(source: EnvSource) {
  return {
    NODE_ENV: blankToUndefined(source.NODE_ENV),
    APP_ENV: blankToUndefined(source.APP_ENV),
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

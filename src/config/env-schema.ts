import { z } from "zod";

export const appEnvSchema = z.enum(["local", "development", "staging", "production"]);
export const nodeEnvSchema = z.enum(["development", "test", "production"]);

export function blankToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

const optionalSecret = z.string().min(1).optional();
const optionalUrl = z.url().optional();
const optionalEmail = z.email().optional();
const optionalPostgresUrl = z
  .string()
  .min(1)
  .refine(
    (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
    "must be a PostgreSQL connection URL (postgres:// or postgresql://)",
  )
  .optional();

/**
 * Values that may be inlined into the browser bundle.
 * Never put DATABASE_URL, DIRECT_URL, or other server secrets here.
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalSecret,
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
});

/**
 * Server-only configuration. Includes database credentials used by Prisma.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  APP_ENV: appEnvSchema.default("local"),
  APP_URL: optionalUrl,

  DATABASE_URL: optionalPostgresUrl,
  DIRECT_URL: optionalPostgresUrl,

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

  STRIPE_SECRET_KEY: optionalSecret,
  STRIPE_PUBLISHABLE_KEY: optionalSecret,
  STRIPE_WEBHOOK_SECRET: optionalSecret,
  PAYPAL_CLIENT_ID: optionalSecret,
  PAYPAL_CLIENT_SECRET: optionalSecret,
  PAYPAL_WEBHOOK_ID: optionalSecret,
  BANK_PROCESSOR_API_KEY: optionalSecret,
  BANK_PROCESSOR_WEBHOOK_SECRET: optionalSecret,

  /**
   * ADR-022 gateway credential KEK keyring (server-only).
   * Active version encrypts new material; prior versions may remain for decrypt during rotation.
   * Never NEXT_PUBLIC_*. Never store KEKs in PostgreSQL.
   */
  GATEWAY_CREDENTIALS_KEY_VERSION: z.coerce.number().int().positive().optional(),
  GATEWAY_CREDENTIALS_KEY_V1: optionalSecret,
  GATEWAY_CREDENTIALS_KEY_V2: optionalSecret,

  /** Application-managed pg_dump output directory on the VPS (server-only, restricted filesystem ACL). */
  BACKUP_DIR: z.string().min(1).optional(),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().positive().optional(),
  BACKUP_MAX_AGE_HOURS: z.coerce.number().int().positive().optional(),
  /** Emergency-only override for production restore scripts. Never store secrets in BACKUP_DIR. */
  BACKUP_RESTORE_ALLOW_PRODUCTION: z.string().optional(),
});

export const envSchema = z.object({
  ...publicEnvSchema.shape,
  ...serverEnvSchema.shape,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type Env = z.infer<typeof envSchema>;
export type AppEnv = z.infer<typeof appEnvSchema>;

export const PUBLIC_ENV_KEYS = Object.freeze(
  Object.keys(publicEnvSchema.shape) as Array<keyof PublicEnv>,
);

export const SERVER_SECRET_ENV_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GATEWAY_CREDENTIALS_KEY_V1",
  "GATEWAY_CREDENTIALS_KEY_V2",
] as const;

export interface EnvSource {
  readonly [key: string]: string | undefined;
}

export interface SupabasePublicConfig {
  readonly url: string;
  readonly anonKey: string;
}

export function readPublicEnvInput(source: EnvSource) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: blankToUndefined(source.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: blankToUndefined(source.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    NEXT_PUBLIC_SENTRY_DSN: blankToUndefined(source.NEXT_PUBLIC_SENTRY_DSN),
  };
}

export function parseSupabasePublicConfig(env: {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
}): SupabasePublicConfig {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required for authentication",
    );
  }

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

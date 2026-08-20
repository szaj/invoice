import "server-only";

import type { AppEnv } from "@/config/env-schema";
import { logger } from "@/lib/logger";
import {
  GENERIC_PASSWORD_RECOVERY_RESPONSE,
  PASSWORD_RECOVERY_RATE_LIMITED,
  PASSWORD_RECOVERY_UNAVAILABLE,
} from "@/domain/auth/errors";
import { forgotPasswordSchema } from "@/domain/auth/password-schema";
import { buildRecoveryCallbackUrl, getApplicationBaseUrl } from "@/domain/auth/redirect";
import {
  getPasswordResetRateLimiter,
  passwordResetRateLimitKey,
  type AuthRateLimiter,
} from "@/server/auth/rate-limit";

export interface PasswordRecoveryProvider {
  requestPasswordRecovery(input: {
    email: string;
    redirectTo: string;
  }): Promise<{ ok: true } | { ok: false; reason: "unavailable" }>;
}

export type PasswordRecoveryResult =
  | { ok: true; message: string }
  | { ok: false; reason: "invalid_input" | "rate_limited" | "unavailable"; error: string };

export interface PasswordRecoveryDependencies {
  readonly rateLimiter: AuthRateLimiter;
  readonly recoveryProvider: PasswordRecoveryProvider;
  readonly clientKey: string;
  readonly appUrl?: string;
  readonly appEnv: AppEnv;
}

export async function requestPasswordRecovery(
  input: unknown,
  deps: PasswordRecoveryDependencies,
): Promise<PasswordRecoveryResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid_input",
      error: "Enter a valid email address.",
    };
  }

  const rate = await deps.rateLimiter.consume(passwordResetRateLimitKey(deps.clientKey));
  if (!rate.allowed) {
    logger.warn({ event: "auth.password_recovery_rate_limited" }, "Password recovery rate limited");
    return {
      ok: false,
      reason: "rate_limited",
      error: PASSWORD_RECOVERY_RATE_LIMITED,
    };
  }

  let redirectTo: string;
  try {
    redirectTo = buildRecoveryCallbackUrl(
      getApplicationBaseUrl({
        appUrl: deps.appUrl,
        appEnv: deps.appEnv,
      }),
    );
  } catch {
    logger.error(
      { event: "auth.password_recovery_misconfigured" },
      "Recovery redirect URL missing",
    );
    return {
      ok: false,
      reason: "unavailable",
      error: PASSWORD_RECOVERY_UNAVAILABLE,
    };
  }

  const requested = await deps.recoveryProvider.requestPasswordRecovery({
    email: parsed.data.email,
    redirectTo,
  });

  if (!requested.ok) {
    logger.error(
      { event: "auth.password_recovery_unavailable" },
      "Password recovery provider unavailable",
    );
    return {
      ok: true,
      message: GENERIC_PASSWORD_RECOVERY_RESPONSE,
    };
  }

  logger.info({ event: "auth.password_recovery_requested" }, "Password recovery requested");
  return {
    ok: true,
    message: GENERIC_PASSWORD_RECOVERY_RESPONSE,
  };
}

export function createDefaultPasswordRecoveryDependencies(
  recoveryProvider: PasswordRecoveryProvider,
  clientKey: string,
  app: { appUrl?: string; appEnv: PasswordRecoveryDependencies["appEnv"] },
): PasswordRecoveryDependencies {
  return {
    rateLimiter: getPasswordResetRateLimiter(),
    recoveryProvider,
    clientKey,
    appUrl: app.appUrl,
    appEnv: app.appEnv,
  };
}

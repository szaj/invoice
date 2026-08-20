import "server-only";

import { logger } from "@/lib/logger";
import { type AuthFailureReason, userSafeLoginMessage } from "@/domain/auth/errors";
import type { ApplicationUserIdentity, AuthenticatedIdentity } from "@/domain/auth/identity";
import { loginSchema } from "@/domain/auth/login-schema";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import {
  getLoginRateLimiter,
  loginRateLimitKey,
  type LoginRateLimiter,
} from "@/server/auth/rate-limit";
import { PrismaUserIdentityStore, type UserIdentityStore } from "@/server/auth/identity-repository";
import {
  getAuditWriter,
  recordAuditEventBestEffort,
  type AuditWriter,
} from "@/server/audit/audit-service";

export interface PasswordIdentityProvider {
  signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<
    | { ok: true; identity: AuthenticatedIdentity }
    | { ok: false; reason: "invalid_credentials" | "unavailable" }
  >;
  signOut(): Promise<void>;
}

export type LoginResult =
  | { ok: true; user: ApplicationUserIdentity }
  | { ok: false; reason: AuthFailureReason; error: string };

export interface LoginDependencies {
  readonly rateLimiter: LoginRateLimiter;
  readonly identityProvider: PasswordIdentityProvider;
  readonly identityStore: UserIdentityStore;
  readonly clientKey: string;
  readonly userAgent?: string | null;
  readonly auditWriter?: AuditWriter;
}

async function recordLoginAudit(
  deps: LoginDependencies,
  input: {
    action: string;
    actorType: "USER" | "SYSTEM";
    actorUserId?: string | null;
    entityId?: string | null;
    newValues: {
      readonly reason?: string;
      readonly email?: string;
    };
  },
): Promise<void> {
  await recordAuditEventBestEffort(
    {
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      entityType: AuditEntityTypes.SESSION,
      entityId: input.entityId ?? null,
      action: input.action,
      newValues: input.newValues,
      ipAddress: deps.clientKey,
      userAgent: deps.userAgent ?? null,
    },
    deps.auditWriter ?? getAuditWriter(),
  );
}

export async function loginWithPassword(
  input: unknown,
  deps: LoginDependencies,
): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid_input",
      error: userSafeLoginMessage("invalid_input"),
    };
  }

  const rate = await deps.rateLimiter.consume(loginRateLimitKey(deps.clientKey));
  if (!rate.allowed) {
    logger.warn({ event: "auth.login_rate_limited" }, "Login rate limit reached");
    await recordLoginAudit(deps, {
      action: AuditActions.LOGIN_FAILED,
      actorType: "SYSTEM",
      newValues: { reason: "rate_limited", email: parsed.data.email },
    });
    return {
      ok: false,
      reason: "rate_limited",
      error: userSafeLoginMessage("rate_limited"),
    };
  }

  const signIn = await deps.identityProvider.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (!signIn.ok) {
    if (signIn.reason === "unavailable") {
      logger.error({ event: "auth.login_unavailable" }, "Login identity provider unavailable");
    } else {
      logger.info({ event: "auth.login_failed", reason: signIn.reason }, "Login rejected");
    }

    await recordLoginAudit(deps, {
      action: AuditActions.LOGIN_FAILED,
      actorType: "SYSTEM",
      newValues: { reason: signIn.reason, email: parsed.data.email },
    });

    return {
      ok: false,
      reason: signIn.reason,
      error: userSafeLoginMessage(signIn.reason),
    };
  }

  try {
    const user = await deps.identityStore.linkAuthenticatedIdentity({
      supabaseAuthUserId: signIn.identity.authUserId,
      email: signIn.identity.email,
    });

    const status = await deps.identityStore.getStatusByAuthUserId(signIn.identity.authUserId);
    if (status === "SUSPENDED") {
      logger.info(
        { event: "auth.login_suspended", userId: user.id },
        "Suspended account login denied",
      );
      await recordLoginAudit(deps, {
        action: AuditActions.LOGIN_FAILED,
        actorType: "USER",
        actorUserId: user.id,
        entityId: user.id,
        newValues: { reason: "suspended", email: user.email },
      });
      try {
        await deps.identityProvider.signOut();
      } catch {
        logger.error(
          { event: "auth.suspended_signout_failed" },
          "Could not clear session after suspended login",
        );
      }
      return {
        ok: false,
        reason: "suspended",
        error: userSafeLoginMessage("suspended"),
      };
    }

    logger.info({ event: "auth.login_succeeded", userId: user.id }, "Login succeeded");
    await recordLoginAudit(deps, {
      action: AuditActions.LOGIN_SUCCEEDED,
      actorType: "USER",
      actorUserId: user.id,
      entityId: user.id,
      newValues: { email: user.email },
    });
    return { ok: true, user };
  } catch (error) {
    logger.error(
      {
        event: "auth.identity_mapping_failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Identity mapping failed after authentication",
    );

    try {
      await deps.identityProvider.signOut();
    } catch {
      logger.error(
        { event: "auth.mapping_failure_signout_failed" },
        "Could not clear session after mapping failure",
      );
    }

    return {
      ok: false,
      reason: "unavailable",
      error: userSafeLoginMessage("unavailable"),
    };
  }
}

export function createDefaultLoginDependencies(
  identityProvider: PasswordIdentityProvider,
  clientKey: string,
  options?: { userAgent?: string | null; auditWriter?: AuditWriter },
): LoginDependencies {
  return {
    rateLimiter: getLoginRateLimiter(),
    identityProvider,
    identityStore: new PrismaUserIdentityStore(),
    clientKey,
    userAgent: options?.userAgent ?? null,
    auditWriter: options?.auditWriter,
  };
}

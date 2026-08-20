import "server-only";

import { logger } from "@/lib/logger";
import {
  type PasswordResetFailureReason,
  userSafePasswordResetMessage,
} from "@/domain/auth/errors";
import { resetPasswordSchema } from "@/domain/auth/password-schema";
import type { AuthenticatedIdentity } from "@/domain/auth/identity";
import { PrismaUserIdentityStore, type UserIdentityStore } from "@/server/auth/identity-repository";

export interface PasswordUpdateProvider {
  getIdentity(): Promise<AuthenticatedIdentity | null>;
  updatePassword(
    password: string,
  ): Promise<{ ok: true } | { ok: false; reason: "invalid_session" | "unavailable" }>;
  signOut(): Promise<void>;
}

export type PasswordUpdateResult =
  { ok: true } | { ok: false; reason: PasswordResetFailureReason; error: string };

export interface PasswordUpdateDependencies {
  readonly identityProvider: PasswordUpdateProvider;
  readonly identityStore: UserIdentityStore;
  readonly hasRecoverySession: () => Promise<boolean>;
  readonly clearRecoverySession: () => Promise<void>;
}

export async function updatePasswordWithSession(
  input: unknown,
  deps: PasswordUpdateDependencies,
): Promise<PasswordUpdateResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid_input",
      error: userSafePasswordResetMessage("invalid_input"),
    };
  }

  const identity = await deps.identityProvider.getIdentity();
  if (!identity) {
    logger.info(
      { event: "auth.password_reset_failed", reason: "invalid_session" },
      "Password reset rejected",
    );
    return {
      ok: false,
      reason: "invalid_session",
      error: userSafePasswordResetMessage("invalid_session"),
    };
  }

  const recoverySession = await deps.hasRecoverySession();
  const applicationUser = await deps.identityStore.findByAuthUserId(identity.authUserId);
  const passwordResetRequired = applicationUser?.passwordResetRequired === true;

  if (!recoverySession && !passwordResetRequired) {
    logger.info(
      { event: "auth.password_reset_failed", reason: "invalid_session" },
      "Password reset rejected",
    );
    return {
      ok: false,
      reason: "invalid_session",
      error: userSafePasswordResetMessage("invalid_session"),
    };
  }

  const updated = await deps.identityProvider.updatePassword(parsed.data.password);
  if (!updated.ok) {
    logger.info(
      { event: "auth.password_reset_failed", reason: updated.reason },
      "Password reset rejected",
    );
    return {
      ok: false,
      reason: updated.reason,
      error: userSafePasswordResetMessage(updated.reason),
    };
  }

  try {
    await deps.identityStore.clearPasswordResetRequired(identity.authUserId);
  } catch (error) {
    logger.error(
      {
        event: "auth.password_reset_flag_clear_failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Could not clear password_reset_required after password update",
    );
  }

  try {
    await deps.clearRecoverySession();
  } catch {
    logger.error(
      { event: "auth.password_reset_marker_clear_failed" },
      "Could not clear recovery marker",
    );
  }

  try {
    await deps.identityProvider.signOut();
  } catch {
    logger.error(
      { event: "auth.password_reset_signout_failed" },
      "Could not clear session after password reset",
    );
  }

  logger.info(
    { event: "auth.password_reset_succeeded", userId: applicationUser?.id },
    "Password reset succeeded",
  );
  return { ok: true };
}

export function createDefaultPasswordUpdateDependencies(
  identityProvider: PasswordUpdateProvider,
  session: {
    hasRecoverySession: () => Promise<boolean>;
    clearRecoverySession: () => Promise<void>;
  },
): PasswordUpdateDependencies {
  return {
    identityProvider,
    identityStore: new PrismaUserIdentityStore(),
    hasRecoverySession: session.hasRecoverySession,
    clearRecoverySession: session.clearRecoverySession,
  };
}

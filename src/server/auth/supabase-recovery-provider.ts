import "server-only";

import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import type { PasswordRecoveryProvider } from "@/server/auth/password-recovery";
import type { PasswordUpdateProvider } from "@/server/auth/password-update";
import { identityFromAuthUser, type AuthenticatedIdentity } from "@/domain/auth/identity";

export class SupabasePasswordRecoveryProvider implements PasswordRecoveryProvider {
  async requestPasswordRecovery(input: {
    email: string;
    redirectTo: string;
  }): Promise<{ ok: true } | { ok: false; reason: "unavailable" }> {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
        redirectTo: input.redirectTo,
      });

      if (error) {
        logger.error(
          { event: "auth.provider_recovery_error" },
          "Supabase Auth recovery request failed",
        );
        return { ok: false, reason: "unavailable" };
      }

      return { ok: true };
    } catch {
      logger.error(
        { event: "auth.provider_recovery_unavailable" },
        "Supabase Auth recovery unavailable",
      );
      return { ok: false, reason: "unavailable" };
    }
  }
}

export class SupabasePasswordUpdateProvider implements PasswordUpdateProvider {
  async getIdentity(): Promise<AuthenticatedIdentity | null> {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        return null;
      }
      return identityFromAuthUser(data.user);
    } catch {
      return null;
    }
  }

  async updatePassword(
    password: string,
  ): Promise<{ ok: true } | { ok: false; reason: "invalid_session" | "unavailable" }> {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        const status = "status" in error ? error.status : undefined;
        if (status === 401 || status === 403 || /session|expired|invalid/i.test(error.message)) {
          return { ok: false, reason: "invalid_session" };
        }

        logger.error(
          { event: "auth.provider_password_update_error" },
          "Supabase Auth password update failed",
        );
        return { ok: false, reason: "unavailable" };
      }

      return { ok: true };
    } catch {
      logger.error(
        { event: "auth.provider_password_update_unavailable" },
        "Supabase Auth password update unavailable",
      );
      return { ok: false, reason: "unavailable" };
    }
  }

  async signOut(): Promise<void> {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "global" });
  }
}

export async function exchangeRecoveryCallback(input: {
  code?: string | null;
  tokenHash?: string | null;
  type?: string | null;
}): Promise<{ ok: true } | { ok: false; reason: "expired" | "invalid" }> {
  try {
    const supabase = await createSupabaseServerClient();
    const code = input.code?.trim();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return { ok: false, reason: classifyProviderRecoveryError(error.message) };
      }
      return { ok: true };
    }

    const tokenHash = input.tokenHash?.trim();
    const type = input.type?.trim().toLowerCase();
    if (tokenHash && type === "recovery") {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      });
      if (error) {
        return { ok: false, reason: classifyProviderRecoveryError(error.message) };
      }
      return { ok: true };
    }

    return { ok: false, reason: "invalid" };
  } catch {
    logger.error({ event: "auth.recovery_callback_unavailable" }, "Recovery callback failed");
    return { ok: false, reason: "invalid" };
  }
}

function classifyProviderRecoveryError(message: string): "expired" | "invalid" {
  if (/expired/i.test(message)) {
    return "expired";
  }
  return "invalid";
}

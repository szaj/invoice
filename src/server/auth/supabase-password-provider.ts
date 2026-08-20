import "server-only";

import { AuthApiError } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import type { AuthenticatedIdentity } from "@/domain/auth/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import type { PasswordIdentityProvider } from "@/server/auth/login";

function isInvalidCredentials(error: unknown): boolean {
  if (error instanceof AuthApiError) {
    return error.status === 400 || error.status === 401;
  }

  if (error && typeof error === "object" && "status" in error) {
    const status = error.status;
    return status === 400 || status === 401;
  }

  return false;
}

export class SupabasePasswordIdentityProvider implements PasswordIdentityProvider {
  async signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<
    | { ok: true; identity: AuthenticatedIdentity }
    | { ok: false; reason: "invalid_credentials" | "unavailable" }
  > {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (error) {
        if (isInvalidCredentials(error)) {
          return { ok: false, reason: "invalid_credentials" };
        }

        logger.error({ event: "auth.provider_error" }, "Supabase Auth sign-in failed");
        return { ok: false, reason: "unavailable" };
      }

      if (!data.user?.id || !data.user.email) {
        return { ok: false, reason: "invalid_credentials" };
      }

      return {
        ok: true,
        identity: {
          authUserId: data.user.id,
          email: data.user.email,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("NEXT_PUBLIC_SUPABASE")) {
        logger.error(
          { event: "auth.env_misconfigured" },
          "Supabase Auth public configuration missing",
        );
        return { ok: false, reason: "unavailable" };
      }

      logger.error({ event: "auth.provider_unavailable" }, "Supabase Auth unavailable");
      return { ok: false, reason: "unavailable" };
    }
  }

  async signOut(): Promise<void> {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
}

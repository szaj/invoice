import "server-only";

import { logger } from "@/lib/logger";
import { GENERIC_LOGOUT_FAILURE } from "@/domain/auth/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export type LogoutResult = { ok: true } | { ok: false; error: string };

export async function logoutCurrentSession(): Promise<LogoutResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.error({ event: "auth.logout_failed" }, "Logout identity provider error");
      return { ok: false, error: GENERIC_LOGOUT_FAILURE };
    }

    logger.info({ event: "auth.logout_succeeded" }, "Logout succeeded");
    return { ok: true };
  } catch {
    logger.error({ event: "auth.logout_unavailable" }, "Logout failed");
    return { ok: false, error: GENERIC_LOGOUT_FAILURE };
  }
}

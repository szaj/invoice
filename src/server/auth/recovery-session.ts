import "server-only";

import { cookies } from "next/headers";

import { getEnv } from "@/config/env";
import { supabaseCookieOptions } from "@/domain/auth/https";

export const PASSWORD_RECOVERY_COOKIE = "app-password-recovery";
export const PASSWORD_RECOVERY_COOKIE_MAX_AGE_SECONDS = 15 * 60;

export function passwordRecoveryCookieOptions() {
  const env = getEnv();
  return {
    ...supabaseCookieOptions(env.APP_ENV),
    httpOnly: true,
    maxAge: PASSWORD_RECOVERY_COOKIE_MAX_AGE_SECONDS,
  };
}

export async function markPasswordRecoverySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PASSWORD_RECOVERY_COOKIE, "1", passwordRecoveryCookieOptions());
}

export async function hasPasswordRecoverySession(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value === "1";
}

export async function clearPasswordRecoverySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PASSWORD_RECOVERY_COOKIE, "", {
    ...passwordRecoveryCookieOptions(),
    maxAge: 0,
  });
}

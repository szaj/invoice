"use server";

import { redirect } from "next/navigation";

import { getEnv } from "@/config/env";
import { LOGIN_PATH } from "@/domain/auth/redirect";
import { loginWithPassword, createDefaultLoginDependencies } from "@/server/auth/login";
import { logoutCurrentSession } from "@/server/auth/logout";
import {
  createDefaultPasswordRecoveryDependencies,
  requestPasswordRecovery,
} from "@/server/auth/password-recovery";
import {
  createDefaultPasswordUpdateDependencies,
  updatePasswordWithSession,
} from "@/server/auth/password-update";
import { getRequestClientKey, getRequestUserAgent } from "@/server/auth/request";
import {
  clearPasswordRecoverySession,
  hasPasswordRecoverySession,
  markPasswordRecoverySession,
} from "@/server/auth/recovery-session";
import { SupabasePasswordIdentityProvider } from "@/server/auth/supabase-password-provider";
import {
  SupabasePasswordRecoveryProvider,
  SupabasePasswordUpdateProvider,
} from "@/server/auth/supabase-recovery-provider";

export type AuthActionResult = { ok: true } | { ok: false; error: string };
export type PasswordRecoveryActionResult =
  { ok: true; message: string } | { ok: false; error: string };

export async function loginAction(input: unknown): Promise<AuthActionResult> {
  const result = await loginWithPassword(
    input,
    createDefaultLoginDependencies(
      new SupabasePasswordIdentityProvider(),
      await getRequestClientKey(),
      { userAgent: await getRequestUserAgent() },
    ),
  );

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  if (result.user.passwordResetRequired) {
    await markPasswordRecoverySession();
    redirect("/reset-password");
  }

  redirect("/");
}

export async function logoutAction(): Promise<AuthActionResult> {
  const result = await logoutCurrentSession({
    ipAddress: await getRequestClientKey(),
    userAgent: await getRequestUserAgent(),
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  redirect("/login");
}

export async function forgotPasswordAction(input: unknown): Promise<PasswordRecoveryActionResult> {
  const env = getEnv();
  const result = await requestPasswordRecovery(
    input,
    createDefaultPasswordRecoveryDependencies(
      new SupabasePasswordRecoveryProvider(),
      await getRequestClientKey(),
      { appUrl: env.APP_URL, appEnv: env.APP_ENV },
    ),
  );

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, message: result.message };
}

export async function resetPasswordAction(input: unknown): Promise<AuthActionResult> {
  const result = await updatePasswordWithSession(
    input,
    createDefaultPasswordUpdateDependencies(new SupabasePasswordUpdateProvider(), {
      hasRecoverySession: hasPasswordRecoverySession,
      clearRecoverySession: clearPasswordRecoverySession,
    }),
  );

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  redirect(`${LOGIN_PATH}?reset=success`);
}

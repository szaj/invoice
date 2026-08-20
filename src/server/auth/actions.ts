"use server";

import { redirect } from "next/navigation";

import { loginWithPassword, createDefaultLoginDependencies } from "@/server/auth/login";
import { logoutCurrentSession } from "@/server/auth/logout";
import { getRequestClientKey } from "@/server/auth/request";
import { SupabasePasswordIdentityProvider } from "@/server/auth/supabase-password-provider";

export type AuthActionResult = { ok: true } | { ok: false; error: string };

export async function loginAction(input: unknown): Promise<AuthActionResult> {
  const result = await loginWithPassword(
    input,
    createDefaultLoginDependencies(
      new SupabasePasswordIdentityProvider(),
      await getRequestClientKey(),
    ),
  );

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  redirect("/");
}

export async function logoutAction(): Promise<AuthActionResult> {
  const result = await logoutCurrentSession();

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  redirect("/login");
}

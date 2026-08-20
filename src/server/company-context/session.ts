import "server-only";

import { cookies } from "next/headers";

import { getEnv } from "@/config/env";
import { supabaseCookieOptions } from "@/domain/auth/https";

export const COMPANY_CONTEXT_COOKIE = "app-company-context";
/** 30 days — preference cookie, revalidated against assignments on every resolve. */
export const COMPANY_CONTEXT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function companyContextCookieOptions() {
  const env = getEnv();
  return {
    ...supabaseCookieOptions(env.APP_ENV),
    httpOnly: true,
    maxAge: COMPANY_CONTEXT_COOKIE_MAX_AGE_SECONDS,
  };
}

export async function readCompanyContextCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COMPANY_CONTEXT_COOKIE)?.value ?? null;
}

export async function writeCompanyContextCookie(value: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COMPANY_CONTEXT_COOKIE, value, companyContextCookieOptions());
}

export async function clearCompanyContextCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COMPANY_CONTEXT_COOKIE, "", {
    ...companyContextCookieOptions(),
    maxAge: 0,
  });
}

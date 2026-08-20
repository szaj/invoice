import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { appEnvSchema, parseSupabasePublicConfig } from "@/config/env-schema";
import { supabaseCookieOptions } from "@/domain/auth/https";
import { identityFromAuthUser, type AuthenticatedIdentity } from "@/domain/auth/identity";

export interface ProxyAuthResult {
  readonly response: NextResponse;
  readonly identity: AuthenticatedIdentity | null;
}

function proxyAppEnv() {
  const parsed = appEnvSchema.safeParse(process.env.APP_ENV?.trim() || "local");
  return parsed.success ? parsed.data : "local";
}

/**
 * Refresh the Supabase Auth session at the Next.js proxy boundary.
 * Uses getUser() so the identity is validated server-side.
 */
export async function refreshAuthSession(request: NextRequest): Promise<ProxyAuthResult> {
  let response = NextResponse.next({ request });

  let config: { url: string; anonKey: string };
  try {
    config = parseSupabasePublicConfig({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
  } catch {
    return { response, identity: null };
  }

  const cookieOptions = supabaseCookieOptions(proxyAppEnv());

  const supabase = createServerClient(config.url, config.anonKey, {
    cookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, { ...options, ...cookieOptions });
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return { response, identity: null };
  }

  return {
    response,
    identity: identityFromAuthUser(data.user),
  };
}

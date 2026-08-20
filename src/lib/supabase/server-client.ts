import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getEnv, requireSupabasePublicConfig } from "@/config/env";
import { supabaseCookieOptions } from "@/domain/auth/https";

/**
 * Server-side Supabase Auth client for Server Components, Route Handlers,
 * and Server Actions. Establishes identity from cookies; does not authorize.
 */
export async function createSupabaseServerClient() {
  const env = getEnv();
  const { url, anonKey } = requireSupabasePublicConfig(env);
  const cookieStore = await cookies();
  const cookieOptions = supabaseCookieOptions(env.APP_ENV);

  return createServerClient(url, anonKey, {
    cookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, { ...options, ...cookieOptions });
          }
        } catch {
          // Server Components cannot always set cookies. proxy.ts refreshes sessions.
        }
      },
    },
  });
}

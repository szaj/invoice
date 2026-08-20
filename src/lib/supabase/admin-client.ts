import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getEnv, requireSupabasePublicConfig, requireSupabaseServiceRoleKey } from "@/config/env";

/**
 * Server-only Supabase client with the service role key.
 * Used for Admin user provisioning. Never import into browser code.
 * Does not authorize; callers must enforce user.manage separately.
 */
export function createSupabaseAdminClient() {
  const env = getEnv();
  const { url } = requireSupabasePublicConfig(env);
  const serviceRoleKey = requireSupabaseServiceRoleKey(env);

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

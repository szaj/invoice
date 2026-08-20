import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseBrowserConfig } from "@/config/public-env";

/**
 * Browser-safe Supabase client.
 * Uses the anon key only. Never import the service role key here.
 */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = requireSupabaseBrowserConfig();
  return createBrowserClient(url, anonKey);
}

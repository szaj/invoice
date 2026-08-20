import { z } from "zod";

import {
  parseSupabasePublicConfig,
  publicEnvSchema,
  readPublicEnvInput,
  type EnvSource,
  type PublicEnv,
  type SupabasePublicConfig,
} from "@/config/env-schema";

/**
 * Browser-safe environment values only.
 * Do not import server secrets into this module.
 */
export function loadPublicEnv(source: EnvSource = process.env): PublicEnv {
  const result = publicEnvSchema.safeParse(readPublicEnvInput(source));

  if (!result.success) {
    throw new Error(`Invalid public environment configuration: ${z.prettifyError(result.error)}`);
  }

  return result.data;
}

export function requireSupabaseBrowserConfig(
  env: PublicEnv = loadPublicEnv(),
): SupabasePublicConfig {
  return parseSupabasePublicConfig(env);
}

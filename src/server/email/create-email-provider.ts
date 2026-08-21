import "server-only";

import { getEnv, type Env } from "@/config/env";
import type { EmailProvider } from "@/server/email/email-provider";
import { MemoryEmailProvider } from "@/server/email/memory-email-provider";
import { ResendEmailAdapter } from "@/server/email/resend-email-adapter";

/**
 * Resolves EmailProvider for the current environment (ADR-007).
 * Prefer Resend when configured; local/test may use an in-memory provider.
 */
export function createEmailProvider(env: Env = getEnv()): EmailProvider {
  if (env.RESEND_API_KEY) {
    return new ResendEmailAdapter(env.RESEND_API_KEY);
  }

  if (env.APP_ENV === "local" || env.NODE_ENV === "test") {
    return new MemoryEmailProvider();
  }

  throw new Error(
    "Transactional email is not configured. Set RESEND_API_KEY (and EMAIL_FROM) for staging/production.",
  );
}

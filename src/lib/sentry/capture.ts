import * as Sentry from "@sentry/nextjs";

import { isSentryConfigured } from "@/lib/sentry/options";

type CaptureContext = {
  readonly tags?: Record<string, string>;
  readonly extra?: Record<string, unknown>;
};

/**
 * Best-effort server/worker exception capture. Never throws.
 */
export async function captureServerException(
  error: unknown,
  context: CaptureContext = {},
): Promise<void> {
  if (!isSentryConfigured("server")) {
    return;
  }

  try {
    Sentry.withScope((scope) => {
      if (context.tags) {
        for (const [key, value] of Object.entries(context.tags)) {
          scope.setTag(key, value);
        }
      }
      if (context.extra) {
        scope.setExtras(context.extra);
      }
      if (error instanceof Error) {
        Sentry.captureException(error);
        return;
      }
      Sentry.captureMessage(typeof error === "string" ? error : "Unknown error");
    });
  } catch {
    // Monitoring must not break application flows.
  }
}

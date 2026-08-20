import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import {
  classifyRecoveryCallback,
  recoveryCallbackReasonQuery,
} from "@/domain/auth/recovery-callback";
import { RESET_PASSWORD_PATH, resolveTrustedAppPath } from "@/domain/auth/redirect";
import { markPasswordRecoverySession } from "@/server/auth/recovery-session";
import { exchangeRecoveryCallback } from "@/server/auth/supabase-recovery-provider";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const classified = classifyRecoveryCallback({
    code: url.searchParams.get("code"),
    token_hash: url.searchParams.get("token_hash"),
    type: url.searchParams.get("type"),
    error: url.searchParams.get("error"),
    error_code: url.searchParams.get("error_code"),
  });

  const nextPath = resolveTrustedAppPath(url.searchParams.get("next"), RESET_PASSWORD_PATH);

  if (classified.kind === "pkce" || classified.kind === "otp") {
    const exchanged = await exchangeRecoveryCallback({
      code: url.searchParams.get("code"),
      tokenHash: url.searchParams.get("token_hash"),
      type: url.searchParams.get("type"),
    });

    if (exchanged.ok) {
      await markPasswordRecoverySession();
      logger.info({ event: "auth.recovery_callback_succeeded" }, "Recovery callback succeeded");
      return NextResponse.redirect(new URL(nextPath, url.origin));
    }

    logger.info(
      { event: "auth.recovery_callback_failed", reason: exchanged.reason },
      "Recovery callback rejected",
    );
    return NextResponse.redirect(
      new URL(`${RESET_PASSWORD_PATH}?reason=${exchanged.reason}`, url.origin),
    );
  }

  const reason = recoveryCallbackReasonQuery(classified.kind) ?? "invalid";
  logger.info({ event: "auth.recovery_callback_failed", reason }, "Recovery callback rejected");
  return NextResponse.redirect(new URL(`${RESET_PASSWORD_PATH}?reason=${reason}`, url.origin));
}

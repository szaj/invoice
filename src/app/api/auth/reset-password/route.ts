import { NextResponse } from "next/server";

import { PASSWORD_RESET_UNAVAILABLE } from "@/domain/auth/errors";
import {
  createDefaultPasswordUpdateDependencies,
  updatePasswordWithSession,
} from "@/server/auth/password-update";
import { isSameOriginRequest } from "@/server/auth/request";
import {
  clearPasswordRecoverySession,
  hasPasswordRecoverySession,
} from "@/server/auth/recovery-session";
import { SupabasePasswordUpdateProvider } from "@/server/auth/supabase-recovery-provider";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: PASSWORD_RESET_UNAVAILABLE }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Enter a valid password and confirmation." },
      { status: 400 },
    );
  }

  const result = await updatePasswordWithSession(
    body,
    createDefaultPasswordUpdateDependencies(new SupabasePasswordUpdateProvider(), {
      hasRecoverySession: hasPasswordRecoverySession,
      clearRecoverySession: clearPasswordRecoverySession,
    }),
  );

  if (!result.ok) {
    const status =
      result.reason === "unavailable" ? 503 : result.reason === "invalid_input" ? 400 : 401;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}

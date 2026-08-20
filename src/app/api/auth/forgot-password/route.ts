import { NextResponse } from "next/server";

import { getEnv } from "@/config/env";
import { PASSWORD_RECOVERY_UNAVAILABLE } from "@/domain/auth/errors";
import {
  createDefaultPasswordRecoveryDependencies,
  requestPasswordRecovery,
} from "@/server/auth/password-recovery";
import { getRequestClientKeyFromRequest, isSameOriginRequest } from "@/server/auth/request";
import { SupabasePasswordRecoveryProvider } from "@/server/auth/supabase-recovery-provider";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: PASSWORD_RECOVERY_UNAVAILABLE }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  const env = getEnv();
  const result = await requestPasswordRecovery(
    body,
    createDefaultPasswordRecoveryDependencies(
      new SupabasePasswordRecoveryProvider(),
      getRequestClientKeyFromRequest(request),
      { appUrl: env.APP_URL, appEnv: env.APP_ENV },
    ),
  );

  if (!result.ok) {
    const status =
      result.reason === "rate_limited" ? 429 : result.reason === "unavailable" ? 503 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, message: result.message });
}

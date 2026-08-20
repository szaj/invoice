import { NextResponse } from "next/server";

import { createDefaultLoginDependencies, loginWithPassword } from "@/server/auth/login";
import {
  getRequestClientKeyFromRequest,
  getRequestUserAgentFromRequest,
  isSameOriginRequest,
} from "@/server/auth/request";
import { SupabasePasswordIdentityProvider } from "@/server/auth/supabase-password-provider";
import { GENERIC_LOGIN_FAILURE, LOGIN_UNAVAILABLE } from "@/domain/auth/errors";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: LOGIN_UNAVAILABLE }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: GENERIC_LOGIN_FAILURE }, { status: 400 });
  }

  const result = await loginWithPassword(
    body,
    createDefaultLoginDependencies(
      new SupabasePasswordIdentityProvider(),
      getRequestClientKeyFromRequest(request),
      { userAgent: getRequestUserAgentFromRequest(request) },
    ),
  );

  if (!result.ok) {
    const status =
      result.reason === "rate_limited"
        ? 429
        : result.reason === "unavailable"
          ? 503
          : result.reason === "suspended"
            ? 403
            : 401;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}

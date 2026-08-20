import { NextResponse } from "next/server";

import { LOGIN_UNAVAILABLE } from "@/domain/auth/errors";
import { logoutCurrentSession } from "@/server/auth/logout";
import { getRequestAuditMetaFromRequest, isSameOriginRequest } from "@/server/auth/request";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: LOGIN_UNAVAILABLE }, { status: 403 });
  }

  const meta = getRequestAuditMetaFromRequest(request);
  const result = await logoutCurrentSession({
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}

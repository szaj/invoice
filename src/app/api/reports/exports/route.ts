import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { createReportExport } from "@/server/reporting/report-export-service";

/**
 * POST /api/reports/exports — enqueue and process a tabular report export (TASK-090).
 * Requires report.export. Staff denied by default (US-009). Export is audited (BR-015).
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const actor = await getRequestAuthorizationPrincipal();
  const result = await createReportExport(actor, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, export: result.data });
}

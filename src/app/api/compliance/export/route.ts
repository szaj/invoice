import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { exportComplianceReport } from "@/server/compliance/compliance-service";

/**
 * GET /api/compliance/export — CSV export of the filtered compliance queue (TASK-075).
 * Requires report.export and compliance.review. Staff receives 403 (US-009).
 * Export is audited. Same query filters as GET /api/compliance/queue.
 */
export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = {
    companyId: url.searchParams.get("companyId") ?? undefined,
    staffUserId: url.searchParams.get("staffUserId") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    amountMin: url.searchParams.get("amountMin") ?? undefined,
    amountMax: url.searchParams.get("amountMax") ?? undefined,
    gateway: url.searchParams.get("gateway") ?? undefined,
    currency: url.searchParams.get("currency") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    subjectType: url.searchParams.get("subjectType") ?? undefined,
  };

  const actor = await getRequestAuthorizationPrincipal();
  const result = await exportComplianceReport(actor, query);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  const { bytes, filename, contentType } = result.data;
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

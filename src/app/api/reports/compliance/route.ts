import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { getComplianceReport } from "@/server/reporting/compliance-report-service";

/**
 * GET /api/reports/compliance — Compliance Report (TASK-087 / §13.3).
 * Requires report.view and compliance.review (Admin/Compliance). Staff receives 403.
 * Review counts, approved/flagged/pending, aging, and notes references.
 * Read-only — does not manipulate audit logs.
 */
export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = {
    companyId: url.searchParams.get("companyId") ?? undefined,
    staffUserId: url.searchParams.get("staffUserId") ?? undefined,
    reportingGroupId: url.searchParams.get("reportingGroupId") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    gateway: url.searchParams.get("gateway") ?? undefined,
    currency: url.searchParams.get("currency") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    subjectType: url.searchParams.get("subjectType") ?? undefined,
  };

  const actor = await getRequestAuthorizationPrincipal();
  const result = await getComplianceReport(actor, query);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, report: result.data });
}

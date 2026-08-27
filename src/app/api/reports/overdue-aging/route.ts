import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { getOverdueAgingReport } from "@/server/reporting/overdue-aging-service";

/**
 * GET /api/reports/overdue-aging — Overdue Aging Report (TASK-081 / §13.3).
 * Requires report.view. Admin all; Compliance assigned; Staff limited to own/assigned.
 * Buckets 1-30 / 31-60 / 61-90 / 90+ (BR-018).
 */
export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = {
    companyId: url.searchParams.get("companyId") ?? undefined,
    customerId: url.searchParams.get("customerId") ?? undefined,
    staffUserId: url.searchParams.get("staffUserId") ?? undefined,
    reportingGroupId: url.searchParams.get("reportingGroupId") ?? undefined,
    invoiceCurrency: url.searchParams.get("invoiceCurrency") ?? undefined,
    countryCode: url.searchParams.get("countryCode") ?? undefined,
    complianceStatus: url.searchParams.get("complianceStatus") ?? undefined,
  };

  const actor = await getRequestAuthorizationPrincipal();
  const result = await getOverdueAgingReport(actor, query);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, report: result.data });
}

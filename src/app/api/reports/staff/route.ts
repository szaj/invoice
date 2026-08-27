import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { getStaffPerformance } from "@/server/reporting/staff-performance-service";

/**
 * GET /api/reports/staff — Staff Performance (TASK-084 / §13.3).
 * Requires report.view. Admin all; Compliance assigned; Staff own/assigned only.
 * Created/sent + value invoiced + collections on assigned invoices — no commission.
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
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    invoiceStatus: url.searchParams.get("invoiceStatus") ?? undefined,
    paymentStatus: url.searchParams.get("paymentStatus") ?? undefined,
    paymentMethod: url.searchParams.get("paymentMethod") ?? undefined,
    invoiceCurrency: url.searchParams.get("invoiceCurrency") ?? undefined,
    settlementCurrency: url.searchParams.get("settlementCurrency") ?? undefined,
    countryCode: url.searchParams.get("countryCode") ?? undefined,
    complianceStatus: url.searchParams.get("complianceStatus") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
    sortBy: url.searchParams.get("sortBy") ?? undefined,
    sortDir: url.searchParams.get("sortDir") ?? undefined,
  };

  const actor = await getRequestAuthorizationPrincipal();
  const result = await getStaffPerformance(actor, query);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, report: result.data });
}

import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { getMonthlyBrandMatrix } from "@/server/reporting/monthly-brand-matrix-service";

/**
 * GET /api/reports/monthly-brand — Monthly Brand / CB-RF Matrix (TASK-088 / §13.3.1).
 * Requires report.view. Gross by payment date; CB/RF by adjustment effective date.
 */
export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = {
    year: url.searchParams.get("year") ?? undefined,
    companyId: url.searchParams.get("companyId") ?? undefined,
    customerId: url.searchParams.get("customerId") ?? undefined,
    staffUserId: url.searchParams.get("staffUserId") ?? undefined,
    reportingGroupId: url.searchParams.get("reportingGroupId") ?? undefined,
    paymentStatus: url.searchParams.get("paymentStatus") ?? undefined,
    paymentMethod: url.searchParams.get("paymentMethod") ?? undefined,
    invoiceCurrency: url.searchParams.get("invoiceCurrency") ?? undefined,
    settlementCurrency: url.searchParams.get("settlementCurrency") ?? undefined,
    countryCode: url.searchParams.get("countryCode") ?? undefined,
    complianceStatus: url.searchParams.get("complianceStatus") ?? undefined,
  };

  const actor = await getRequestAuthorizationPrincipal();
  const result = await getMonthlyBrandMatrix(actor, query);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, report: result.data });
}

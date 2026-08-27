import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { listComplianceQueue } from "@/server/compliance/compliance-service";

/**
 * GET /api/compliance/queue — compliance review queue with filters (TASK-072).
 * Requires compliance.review (Admin/Compliance). Staff receives 403.
 * Compliance is limited to assigned companies; Admin may see all.
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
  const result = await listComplianceQueue(actor, query);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, items: result.data });
}

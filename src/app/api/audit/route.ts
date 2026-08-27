import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { listAuditEvents } from "@/server/audit/audit-query-service";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";

/**
 * GET /api/audit — read-only filtered audit viewer (TASK-076).
 * Requires audit.read. Admin may see all companies; Compliance is limited to assigned companies.
 * Staff is denied (US-010). No POST/PUT/PATCH/DELETE — audit rows are append-only.
 */
export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = {
    companyId: url.searchParams.get("companyId") ?? undefined,
    actorUserId: url.searchParams.get("actorUserId") ?? undefined,
    actorType: url.searchParams.get("actorType") ?? undefined,
    entityType: url.searchParams.get("entityType") ?? undefined,
    entityId: url.searchParams.get("entityId") ?? undefined,
    action: url.searchParams.get("action") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  };

  const actor = await getRequestAuthorizationPrincipal();
  const result = await listAuditEvents(actor, query);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, events: result.data });
}

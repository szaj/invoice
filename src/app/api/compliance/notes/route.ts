import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { COMPLIANCE_INVALID_INPUT } from "@/domain/compliance/types";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { addComplianceNote, listComplianceNotes } from "@/server/compliance/compliance-service";

/**
 * GET /api/compliance/notes — list compliance review notes for a subject (TASK-073).
 * Query: subjectType, subjectId, companyId (required for CUSTOMER).
 * Requires compliance.review. Staff receives 403.
 */
export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = {
    subjectType: url.searchParams.get("subjectType") ?? undefined,
    subjectId: url.searchParams.get("subjectId") ?? undefined,
    companyId: url.searchParams.get("companyId") ?? undefined,
  };

  const actor = await getRequestAuthorizationPrincipal();
  const result = await listComplianceNotes(actor, query);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, reviews: result.data });
}

/**
 * POST /api/compliance/notes — add internal notes / reason / resolution (TASK-073).
 * Does not change compliance status. Requires compliance.review. Staff receives 403.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  let body: unknown = {};
  const raw = await request.text();
  if (raw.trim().length > 0) {
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      return NextResponse.json({ ok: false, error: COMPLIANCE_INVALID_INPUT }, { status: 400 });
    }
  }

  const actor = await getRequestAuthorizationPrincipal();
  const result = await addComplianceNote(actor, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      ok: true,
      subjectType: result.data.subjectType,
      subjectId: result.data.subjectId,
      companyId: result.data.companyId,
      status: result.data.status,
      review: result.data.review,
    },
    { status: 201 },
  );
}

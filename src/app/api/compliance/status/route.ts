import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { COMPLIANCE_INVALID_INPUT } from "@/domain/compliance/types";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { updateComplianceStatus } from "@/server/compliance/compliance-service";

/**
 * POST /api/compliance/status — set compliance status on invoice/payment/customer.
 * Accepts optional notes, reason codes, resolution notes, evidence refs (TASK-073).
 * Requires compliance.review (Admin/Compliance). Staff receives 403.
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
  const result = await updateComplianceStatus(actor, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      ok: true,
      subjectType: result.data.subjectType,
      subjectId: result.data.subjectId,
      companyId: result.data.companyId,
      previousStatus: result.data.previousStatus,
      status: result.data.status,
      review: result.data.review,
    },
    { status: result.data.review ? 201 : 200 },
  );
}

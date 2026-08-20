import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { INVALID_COMPANY_CONTEXT_MESSAGE } from "@/domain/company-context/types";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { assertTransactionalCompanyRequest } from "@/server/company-context/transactional";

/**
 * Representative transactional company-scoped check (TASK-009).
 * Rejects All Companies context and cross-company IDOR.
 * Real customer/invoice/payment writes will use the same domain enforcement later.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: INVALID_COMPANY_CONTEXT_MESSAGE },
      { status: 400 },
    );
  }

  const companyId =
    body && typeof body === "object" && "companyId" in body && typeof body.companyId === "string"
      ? body.companyId
      : null;
  if (companyId == null) {
    return NextResponse.json(
      { ok: false, error: INVALID_COMPANY_CONTEXT_MESSAGE },
      { status: 400 },
    );
  }

  const principal = await getRequestAuthorizationPrincipal();
  if (!principal?.roleCode || principal.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const result = await assertTransactionalCompanyRequest(principal, companyId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, companyId: result.companyId });
}

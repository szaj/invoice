import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { INVALID_COMPANY_CONTEXT_MESSAGE } from "@/domain/company-context/types";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  getCompanyContextView,
  setCompanyContextSelection,
} from "@/server/company-context/service";

export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const principal = await getRequestAuthorizationPrincipal();
  if (!principal?.roleCode || principal.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const view = await getCompanyContextView(principal);
  return NextResponse.json({
    ok: true,
    context: {
      selection: view.selection,
      allowsAllCompanies: view.allowsAllCompanies,
      companies: view.companies,
      resolved: view.resolved.status === "resolved",
    },
  });
}

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

  const value =
    body && typeof body === "object" && "value" in body && typeof body.value === "string"
      ? body.value
      : null;
  if (value == null) {
    return NextResponse.json(
      { ok: false, error: INVALID_COMPANY_CONTEXT_MESSAGE },
      { status: 400 },
    );
  }

  const principal = await getRequestAuthorizationPrincipal();
  const result = await setCompanyContextSelection(principal, value);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, selection: result.data });
}

import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { getCustomer, updateCustomer } from "@/server/customers/customer-service";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const { id } = await context.params;
  const actor = await getRequestAuthorizationPrincipal();
  const result = await getCustomer(actor, id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, customer: result.data });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Check the customer details and try again." },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const actor = await getRequestAuthorizationPrincipal();
  const result = await updateCustomer(actor, id, body);
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        ...(result.code ? { code: result.code } : {}),
        ...(result.duplicates ? { duplicates: result.duplicates } : {}),
      },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, customer: result.data });
}

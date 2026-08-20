import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { SETTLEMENT_INVALID_INPUT } from "@/domain/settlement/types";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { updatePaymentMethodSettlementConfiguration } from "@/server/settlement/settlement-service";

type RouteContext = { params: Promise<{ id: string; methodCode: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: SETTLEMENT_INVALID_INPUT }, { status: 400 });
  }

  const { id, methodCode } = await context.params;
  const actor = await getRequestAuthorizationPrincipal();
  const result = await updatePaymentMethodSettlementConfiguration(actor, id, methodCode, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, configuration: result.data });
}

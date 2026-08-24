import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { PAYMENT_INVALID_INPUT } from "@/domain/payments/types";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { listHostedCheckoutOptions } from "@/server/payments/payment-service";

/**
 * GET /api/payments/checkout-options?invoiceId= — company-enabled hosted checkout methods (TASK-058).
 * Disabled / uncredentialed / unsupported methods are omitted.
 */
export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const invoiceId = new URL(request.url).searchParams.get("invoiceId");
  if (!invoiceId) {
    return NextResponse.json({ ok: false, error: PAYMENT_INVALID_INPUT }, { status: 400 });
  }

  const actor = await getRequestAuthorizationPrincipal();
  const result = await listHostedCheckoutOptions(actor, invoiceId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, options: result.data });
}

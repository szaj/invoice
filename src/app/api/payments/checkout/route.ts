import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { PAYMENT_INVALID_INPUT } from "@/domain/payments/types";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { createHostedCheckout } from "@/server/payments/payment-service";

/**
 * POST /api/payments/checkout — create hosted checkout + PENDING payment (TASK-058).
 * Does not confirm SUCCESSFUL; webhooks own confirmation. No invoice allocation.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: PAYMENT_INVALID_INPUT }, { status: 400 });
  }

  const actor = await getRequestAuthorizationPrincipal();
  const result = await createHostedCheckout(actor, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      ok: true,
      payment: result.data.payment,
      checkoutUrl: result.data.checkoutUrl,
      externalTransactionId: result.data.externalTransactionId,
    },
    { status: 201 },
  );
}

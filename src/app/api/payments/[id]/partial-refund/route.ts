import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { REFUND_INVALID_INPUT } from "@/domain/refunds/types";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { processPartialRefund } from "@/server/refunds/refund-service";

/**
 * POST /api/payments/{id}/partial-refund — record a processed partial refund (TASK-065).
 * Creates a linked payment_adjustments REFUND/PROCESSED row for the partial amount.
 * Cumulative deductions cannot exceed the original payment (over-refund rejected).
 * Does not rewrite the original payment. UI remains TASK-069.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  let body: unknown = {};
  const raw = await request.text();
  if (raw.trim().length > 0) {
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      return NextResponse.json({ ok: false, error: REFUND_INVALID_INPUT }, { status: 400 });
    }
  }

  const { id } = await context.params;
  const actor = await getRequestAuthorizationPrincipal();
  const result = await processPartialRefund(actor, id, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      ok: true,
      payment: result.data.payment,
      adjustment: result.data.adjustment,
      lifecycle: result.data.lifecycle,
      providerRefund: result.data.providerRefund,
    },
    { status: 201 },
  );
}

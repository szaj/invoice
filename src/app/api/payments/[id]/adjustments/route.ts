import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { listPaymentAdjustments } from "@/server/payments/adjustment-history-service";

/**
 * GET /api/payments/{id}/adjustments — list linked adjustment history (TASK-068).
 * Includes CANCELLED rows for audit. View follows payment access. UI remains TASK-069.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const { id } = await context.params;
  const actor = await getRequestAuthorizationPrincipal();
  const result = await listPaymentAdjustments(actor, id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    payment: result.data.payment,
    adjustments: result.data.adjustments,
  });
}

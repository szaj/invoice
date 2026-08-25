import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { ADJUSTMENT_NOTE_INVALID_INPUT } from "@/domain/payments/adjustment-history";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { addPaymentAdjustmentNote } from "@/server/payments/adjustment-history-service";

/**
 * POST /api/payments/{id}/adjustment-note — add informational adjustment note (TASK-068).
 * Creates NOTE + OPEN on payment_adjustments. No financial effect. Requires payment.adjust.
 * UI remains TASK-069.
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
      return NextResponse.json(
        { ok: false, error: ADJUSTMENT_NOTE_INVALID_INPUT },
        { status: 400 },
      );
    }
  }

  const { id } = await context.params;
  const actor = await getRequestAuthorizationPrincipal();
  const result = await addPaymentAdjustmentNote(actor, id, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      ok: true,
      payment: result.data.payment,
      adjustment: result.data.adjustment,
    },
    { status: 201 },
  );
}

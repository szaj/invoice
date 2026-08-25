import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { CHARGEBACK_INVALID_INPUT } from "@/domain/chargebacks/types";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { recordChargebackWonReversal } from "@/server/chargebacks/chargeback-service";

/**
 * POST /api/payments/{id}/chargeback-won — record Chargeback Won/Reversal (TASK-067).
 * Creates a linked payment_adjustments REVERSAL/WON|REVERSED row. Does not rewrite the
 * original payment or debit row. Restores net CB/RF impact (BR-024). UI remains TASK-069.
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
      return NextResponse.json({ ok: false, error: CHARGEBACK_INVALID_INPUT }, { status: 400 });
    }
  }

  const { id } = await context.params;
  const actor = await getRequestAuthorizationPrincipal();
  const result = await recordChargebackWonReversal(actor, id, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      ok: true,
      payment: result.data.payment,
      adjustment: result.data.adjustment,
      debitAdjustment: result.data.debitAdjustment,
      lifecycle: result.data.lifecycle,
    },
    { status: 201 },
  );
}

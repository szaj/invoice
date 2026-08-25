import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { CHARGEBACK_INVALID_INPUT } from "@/domain/chargebacks/types";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { recordChargebackDebitLoss } from "@/server/chargebacks/chargeback-service";

/**
 * POST /api/payments/{id}/chargeback-debit — record Chargeback Debit/Loss (TASK-066).
 * Creates a linked payment_adjustments CHARGEBACK/DEBITED|LOST row. Does not rewrite the original payment.
 * Included in CB/RF (BR-024). UI remains TASK-069.
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
  const result = await recordChargebackDebitLoss(actor, id, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      ok: true,
      payment: result.data.payment,
      adjustment: result.data.adjustment,
      lifecycle: result.data.lifecycle,
    },
    { status: 201 },
  );
}

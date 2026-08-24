import { NextResponse } from "next/server";

import { processPayPalWebhook } from "@/server/payments/paypal-webhook-service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ companyId: string }>;
};

/**
 * PayPal webhook endpoint (TASK-055).
 * Auth is provider signature verification (company-isolated webhook id + credentials).
 * Does not use session cookies or user RBAC.
 */
export async function POST(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const payload = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const result = await processPayPalWebhook(companyId, payload, headers);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      ok: true,
      duplicate: result.data.duplicate,
      outcome: result.data.outcome,
      paymentEventId: result.data.paymentEventId,
      paymentId: result.data.paymentId,
    },
    { status: 200 },
  );
}

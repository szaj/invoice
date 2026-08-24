import { NextResponse } from "next/server";

import { processStripeWebhook } from "@/server/payments/stripe-webhook-service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ companyId: string }>;
};

/**
 * Stripe webhook endpoint (TASK-053).
 * Auth is provider signature verification (company-isolated webhook secret).
 * Does not use session cookies or user RBAC.
 */
export async function POST(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const payload = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const result = await processStripeWebhook(companyId, payload, headers);
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

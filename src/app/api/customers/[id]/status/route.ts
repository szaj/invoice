import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { setCustomerStatus } from "@/server/customers/customer-service";

/**
 * Soft-deactivate / reactivate. Never hard-deletes (BR-012).
 * Requires customer.delete (Admin).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  let body: unknown = { status: "INACTIVE" };
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as unknown;
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "Check the customer details and try again." },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const actor = await getRequestAuthorizationPrincipal();
  const result = await setCustomerStatus(actor, id, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, customer: result.data });
}

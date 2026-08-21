import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { getCustomerFinancialSummary } from "@/server/customers/customer-financial-summary-service";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const query = {
    companyId: url.searchParams.get("companyId") ?? undefined,
  };

  const actor = await getRequestAuthorizationPrincipal();
  const result = await getCustomerFinancialSummary(actor, id, query);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    customerId: result.data.customerId,
    companyFilterId: result.data.companyFilterId,
    financialSummary: result.data.financialSummary,
  });
}

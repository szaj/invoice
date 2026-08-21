import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { generateInvoicePdf, listInvoicePdfFiles } from "@/server/invoices/invoice-pdf-service";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const actor = await getRequestAuthorizationPrincipal();
  const result = await listInvoicePdfFiles(actor, id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, files: result.data });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const { id } = await context.params;
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const payload =
    body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const actor = await getRequestAuthorizationPrincipal();
  const result = await generateInvoicePdf(actor, id, {
    invoiceVersionId:
      typeof payload.invoiceVersionId === "string" ? payload.invoiceVersionId : null,
    pageSize: payload.pageSize,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    file: result.data,
    reusedExisting: result.data.reusedExisting,
  });
}

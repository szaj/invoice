import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { createDraftInvoice, listDraftInvoices } from "@/server/invoices/invoice-draft-service";
import { rejectHandEditedInvoiceNumber } from "@/server/invoices/invoice-number-service";

export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = {
    companyId: url.searchParams.get("companyId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  };

  const actor = await getRequestAuthorizationPrincipal();
  const result = await listDraftInvoices(actor, query);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, invoices: result.data });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Check the invoice details and try again." },
      { status: 400 },
    );
  }

  const handEdit = rejectHandEditedInvoiceNumber(body);
  if (handEdit) {
    return NextResponse.json({ ok: false, error: handEdit.error }, { status: handEdit.status });
  }

  const actor = await getRequestAuthorizationPrincipal();
  const result = await createDraftInvoice(actor, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, invoice: result.data }, { status: 201 });
}

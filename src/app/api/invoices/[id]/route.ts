import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { INVOICE_ISSUED_FINANCIAL_EDIT_FORBIDDEN } from "@/domain/invoices/versions";
import { payloadContainsIssuedFinancialFields } from "@/domain/invoices/versions";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { getDraftInvoice, updateDraftInvoice } from "@/server/invoices/invoice-draft-service";
import { rejectHandEditedInvoiceNumber } from "@/server/invoices/invoice-number-service";
import { updateIssuedInvoiceMetadata } from "@/server/invoices/invoice-version-service";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(_request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const { id } = await context.params;
  const actor = await getRequestAuthorizationPrincipal();
  const result = await getDraftInvoice(actor, id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, invoice: result.data });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
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

  const { id } = await context.params;
  const actor = await getRequestAuthorizationPrincipal();
  const existing = await getDraftInvoice(actor, id);
  if (!existing.ok) {
    return NextResponse.json({ ok: false, error: existing.error }, { status: existing.status });
  }

  if (existing.data.status === "DRAFT") {
    const result = await updateDraftInvoice(actor, id, body);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, invoice: result.data });
  }

  if (payloadContainsIssuedFinancialFields(body)) {
    return NextResponse.json(
      { ok: false, error: INVOICE_ISSUED_FINANCIAL_EDIT_FORBIDDEN },
      { status: 400 },
    );
  }

  const result = await updateIssuedInvoiceMetadata(actor, id, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, invoice: result.data });
}

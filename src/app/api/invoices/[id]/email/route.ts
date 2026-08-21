import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { listInvoiceEmailLogs, sendInvoiceEmail } from "@/server/invoices/invoice-email-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const actor = await getRequestAuthorizationPrincipal();
  const result = await listInvoiceEmailLogs(actor, id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, logs: result.data });
}

export async function POST(request: Request, context: RouteContext) {
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

  const { parseEmailAddressList } = await import("@/domain/invoices/email");
  const cc = Array.isArray(payload.cc)
    ? payload.cc.filter((value): value is string => typeof value === "string")
    : typeof payload.cc === "string"
      ? parseEmailAddressList(payload.cc)
      : [];
  const bcc = Array.isArray(payload.bcc)
    ? payload.bcc.filter((value): value is string => typeof value === "string")
    : typeof payload.bcc === "string"
      ? parseEmailAddressList(payload.bcc)
      : [];

  const actor = await getRequestAuthorizationPrincipal();
  const result = await sendInvoiceEmail(actor, id, {
    invoiceFileId: typeof payload.invoiceFileId === "string" ? payload.invoiceFileId : null,
    recipientOverride: typeof payload.recipient === "string" ? payload.recipient : null,
    cc,
    bcc,
    paymentLink: typeof payload.paymentLink === "string" ? payload.paymentLink : null,
    subjectOverride: typeof payload.subject === "string" ? payload.subject : null,
    bodyOverride: typeof payload.body === "string" ? payload.body : null,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, log: result.data });
}

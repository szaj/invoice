import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { downloadInvoicePdf } from "@/server/invoices/invoice-pdf-service";

type RouteContext = { params: Promise<{ id: string; fileId: string }> };

/**
 * Stream a stored invoice PDF for preview (inline) or download (attachment).
 * Does not regenerate PDF bytes when the file row exists (TASK-040 / ADR-013).
 */
export async function GET(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const { id, fileId } = await context.params;
  const url = new URL(request.url);
  const dispositionParam = url.searchParams.get("disposition");
  const disposition = dispositionParam === "attachment" ? "attachment" : "inline";

  const actor = await getRequestAuthorizationPrincipal();
  const result = await downloadInvoicePdf(actor, id, { fileId, disposition });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  const { bytes, filename, file } = result.data;
  const contentDisposition =
    disposition === "attachment"
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`;

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": contentDisposition,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

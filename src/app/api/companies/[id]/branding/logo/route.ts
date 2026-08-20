import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  createDefaultCompanyBrandingDependencies,
  getCompanyBranding,
  removeCompanyLogo,
  uploadCompanyLogo,
} from "@/server/companies/branding-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const { id } = await context.params;
  const actor = await getRequestAuthorizationPrincipal();
  const deps = createDefaultCompanyBrandingDependencies();
  const branding = await getCompanyBranding(actor, id, deps);
  if (!branding.ok) {
    return NextResponse.json({ ok: false, error: branding.error }, { status: branding.status });
  }
  if (!branding.data.logo) {
    return NextResponse.json({ ok: false, error: "Logo not found." }, { status: 404 });
  }

  const object = await deps.storage.getObject(branding.data.logo.storageKey);
  if (!object) {
    return NextResponse.json({ ok: false, error: "Logo not found." }, { status: 404 });
  }

  return new NextResponse(Buffer.from(object.body), {
    status: 200,
    headers: {
      "Content-Type": object.contentType,
      "Content-Length": String(object.body.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, error: "Logo upload must use multipart form data." },
      { status: 400 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "The logo upload is invalid." }, { status: 400 });
  }

  const file = formData.get("logo");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Choose a logo image to upload." },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { id } = await context.params;
  const actor = await getRequestAuthorizationPrincipal();
  const result = await uploadCompanyLogo(actor, id, {
    bytes,
    declaredMimeType: file.type,
    originalFilename: file.name,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, branding: result.data });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const { id } = await context.params;
  const actor = await getRequestAuthorizationPrincipal();
  const result = await removeCompanyLogo(actor, id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, branding: result.data });
}

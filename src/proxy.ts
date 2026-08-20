import { NextResponse, type NextRequest } from "next/server";

import {
  isLoginPagePath,
  isPublicAuthPath,
  requestIsHttps,
  requiresHttps,
} from "@/domain/auth/https";
import { refreshAuthSession } from "@/lib/supabase/proxy-client";
import { appEnvSchema } from "@/config/env-schema";

function currentAppEnv() {
  const parsed = appEnvSchema.safeParse(process.env.APP_ENV?.trim() || "local");
  return parsed.success ? parsed.data : "local";
}

export async function proxy(request: NextRequest) {
  const appEnv = currentAppEnv();

  if (requiresHttps(appEnv) && !requestIsHttps(request)) {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 308);
  }

  const { response, identity } = await refreshAuthSession(request);
  const pathname = request.nextUrl.pathname;
  const isPublic = isPublicAuthPath(pathname);

  if (!identity && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (identity && isLoginPagePath(pathname)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

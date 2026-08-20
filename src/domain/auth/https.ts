import type { AppEnv } from "@/config/env-schema";

export function requiresHttps(appEnv: AppEnv): boolean {
  return appEnv !== "local";
}

export function requestIsHttps(request: {
  headers: { get(name: string): string | null };
  nextUrl: { protocol: string };
}): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() === "https";
  }

  return request.nextUrl.protocol === "https:";
}

export function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/forgot-password/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/") ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/auth/callback/") ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/auth/forgot-password" ||
    pathname === "/api/auth/reset-password"
  );
}

export function isLoginPagePath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/");
}

export function isAuthenticatedAuthEntryPath(pathname: string): boolean {
  return (
    isLoginPagePath(pathname) ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/forgot-password/")
  );
}

export function supabaseCookieOptions(appEnv: AppEnv): {
  path: "/";
  sameSite: "lax";
  secure: boolean;
} {
  return {
    path: "/",
    sameSite: "lax",
    secure: requiresHttps(appEnv),
  };
}

import type { AppEnv } from "@/config/env-schema";

export const DEFAULT_LOCAL_APP_URL = "http://localhost:3000";
export const RECOVERY_CALLBACK_PATH = "/auth/callback";
export const RESET_PASSWORD_PATH = "/reset-password";
export const LOGIN_PATH = "/login";

export const TRUSTED_AUTH_REDIRECT_PATHS = Object.freeze([RESET_PASSWORD_PATH, LOGIN_PATH, "/"]);

export function normalizeApplicationBaseUrl(appUrl: string): string {
  return appUrl.trim().replace(/\/+$/, "");
}

export function getApplicationBaseUrl(input: { appUrl?: string; appEnv: AppEnv }): string {
  const configured = input.appUrl?.trim();
  if (configured) {
    return normalizeApplicationBaseUrl(configured);
  }

  if (input.appEnv === "local") {
    return DEFAULT_LOCAL_APP_URL;
  }

  throw new Error("APP_URL is required outside local development");
}

export function buildRecoveryCallbackUrl(baseUrl: string): string {
  return `${normalizeApplicationBaseUrl(baseUrl)}${RECOVERY_CALLBACK_PATH}`;
}

/**
 * Resolve a post-auth path against an allowlist.
 * Rejects absolute URLs, protocol-relative URLs, and unknown paths.
 */
export function resolveTrustedAppPath(
  candidate: string | null | undefined,
  fallback: string,
): string {
  if (!candidate) {
    return fallback;
  }

  const trimmed = candidate.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }

  if (trimmed.includes("\\") || trimmed.includes("://") || trimmed.includes("%2f%2f")) {
    return fallback;
  }

  const pathOnly = trimmed.split("?")[0]?.split("#")[0] ?? "";
  if (!(TRUSTED_AUTH_REDIRECT_PATHS as readonly string[]).includes(pathOnly)) {
    return fallback;
  }

  return pathOnly;
}

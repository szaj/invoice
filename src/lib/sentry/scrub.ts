import type { ErrorEvent, EventHint } from "@sentry/nextjs";

const SENSITIVE_KEY_FRAGMENTS = [
  "password",
  "secret",
  "token",
  "credential",
  "apikey",
  "api_key",
  "webhook",
  "ciphertext",
  "dek",
  "kek",
  "nonce",
  "auth_tag",
  "authtag",
  "cvv",
  "card_number",
  "cardnumber",
  "client_secret",
  "clientsecret",
  "publishablekey",
  "secretkey",
  "wrappeddek",
  "authorization",
  "cookie",
] as const;

const SENSITIVE_VALUE_PATTERNS = [
  /^sk_(live|test)_/i,
  /^pk_(live|test)_/i,
  /^whsec_/i,
  /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\./,
] as const;

function normalizeKey(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (/(?:^|_)pan(?:$|_)/.test(normalized)) {
    return true;
  }
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function isSensitiveValue(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return "[Truncated]";
  }
  if (value == null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return isSensitiveValue(value) ? "[Redacted]" : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => scrubValue(entry, depth + 1));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      output[key] = isSensitiveKey(key) ? "[Redacted]" : scrubValue(entry, depth + 1);
    }
    return output;
  }
  return value;
}

/**
 * Removes payment credentials and other prohibited data before Sentry upload (ADR-015 / ADR-022).
 */
export function scrubSentryEvent(event: ErrorEvent, hint?: EventHint): ErrorEvent | null {
  void hint;
  if (event.request?.headers) {
    event.request.headers = scrubValue(event.request.headers) as typeof event.request.headers;
  }
  if (event.request?.cookies) {
    delete event.request.cookies;
  }
  if (event.request?.data) {
    event.request.data = scrubValue(event.request.data);
  }
  if (event.extra) {
    event.extra = scrubValue(event.extra) as typeof event.extra;
  }
  if (event.contexts) {
    event.contexts = scrubValue(event.contexts) as typeof event.contexts;
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
      ...breadcrumb,
      data: breadcrumb.data ? (scrubValue(breadcrumb.data) as Record<string, unknown>) : undefined,
    }));
  }
  return event;
}

import type { AuditJson } from "@/domain/audit/types";

const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|authorization|cookie|api[_-]?key|access[_-]?key|webhook|credential|private[_-]?key|card|cvv|pan)/i;

const REDACTED = "[Redacted]";

/**
 * Recursively masks sensitive keys before audit persistence.
 * Never store passwords, tokens, gateway secrets, or raw card data.
 */
export function maskSensitiveAuditValues(value: unknown): AuditJson {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => maskSensitiveAuditValues(entry));
  }

  if (typeof value === "object") {
    const result: Record<string, AuditJson> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = REDACTED;
        continue;
      }
      result[key] = maskSensitiveAuditValues(entry);
    }
    return result;
  }

  return String(value);
}

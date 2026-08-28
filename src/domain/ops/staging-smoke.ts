export interface StagingHealthResponse {
  readonly ok: boolean;
  readonly status: string;
  readonly checks?: Readonly<Record<string, string>>;
}

/**
 * Parse `/api/health` JSON for staging smoke checks.
 * Returns null when the payload does not match the expected shape.
 */
export function parseStagingHealthResponse(body: unknown): StagingHealthResponse | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;
  if (typeof record.ok !== "boolean" || typeof record.status !== "string") {
    return null;
  }

  let checks: Record<string, string> | undefined;
  if (record.checks !== undefined) {
    if (!record.checks || typeof record.checks !== "object") {
      return null;
    }
    checks = {};
    for (const [key, value] of Object.entries(record.checks as Record<string, unknown>)) {
      if (typeof value !== "string") {
        return null;
      }
      checks[key] = value;
    }
  }

  return {
    ok: record.ok,
    status: record.status,
    checks,
  };
}

export function isStagingSmokeHealthy(response: StagingHealthResponse): boolean {
  return response.ok && response.status !== "UNHEALTHY";
}

export function normalizeStagingSmokeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

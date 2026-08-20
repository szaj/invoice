export type RecoveryCallbackParams = {
  readonly code?: string | null;
  readonly token_hash?: string | null;
  readonly type?: string | null;
  readonly error?: string | null;
  readonly error_code?: string | null;
};

export type RecoveryCallbackClassification =
  | { kind: "pkce" }
  | { kind: "otp" }
  | { kind: "expired" }
  | { kind: "invalid" }
  | { kind: "malformed" };

const EXPIRED_ERROR_CODES = new Set(["otp_expired", "flow_state_expired"]);

export function classifyRecoveryCallback(
  params: RecoveryCallbackParams,
): RecoveryCallbackClassification {
  const errorCode = params.error_code?.trim().toLowerCase();
  if (errorCode && EXPIRED_ERROR_CODES.has(errorCode)) {
    return { kind: "expired" };
  }

  if (params.error?.trim()) {
    return { kind: "invalid" };
  }

  const code = params.code?.trim();
  if (code) {
    return { kind: "pkce" };
  }

  const tokenHash = params.token_hash?.trim();
  const type = params.type?.trim().toLowerCase();
  if (tokenHash && type === "recovery") {
    return { kind: "otp" };
  }

  if (tokenHash || type) {
    return { kind: "invalid" };
  }

  return { kind: "malformed" };
}

export function recoveryCallbackReasonQuery(
  kind: RecoveryCallbackClassification["kind"],
): "expired" | "invalid" | "malformed" | null {
  if (kind === "pkce" || kind === "otp") {
    return null;
  }

  return kind;
}

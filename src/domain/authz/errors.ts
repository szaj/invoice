export const GENERIC_FORBIDDEN = "You do not have permission to perform this action.";

export type AuthorizationDenialReason = "unauthenticated" | "suspended" | "missing_role" | "denied";

export class AuthorizationError extends Error {
  readonly status: 401 | 403;
  readonly reason: AuthorizationDenialReason;

  constructor(reason: AuthorizationDenialReason) {
    super(GENERIC_FORBIDDEN);
    this.name = "AuthorizationError";
    this.reason = reason;
    this.status = reason === "unauthenticated" ? 401 : 403;
  }
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

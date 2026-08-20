export const GENERIC_LOGIN_FAILURE = "Invalid email or password.";
export const LOGIN_UNAVAILABLE = "Sign in is temporarily unavailable.";
export const LOGIN_RATE_LIMITED = "Too many sign-in attempts. Try again later.";
export const ACCOUNT_SUSPENDED = "This account is suspended.";
export const GENERIC_LOGOUT_FAILURE = "Sign out is temporarily unavailable.";

export const GENERIC_PASSWORD_RECOVERY_RESPONSE =
  "If an account exists for this email, password recovery instructions have been sent.";
export const PASSWORD_RECOVERY_RATE_LIMITED =
  "Too many password recovery attempts. Try again later.";
export const PASSWORD_RECOVERY_UNAVAILABLE = "Password recovery is temporarily unavailable.";
export const PASSWORD_RESET_INVALID_LINK =
  "This password reset link is invalid or has expired. Request a new one.";
export const PASSWORD_RESET_EXPIRED_LINK =
  "This password reset link has expired. Request a new one.";
export const PASSWORD_RESET_UNAVAILABLE = "Password reset is temporarily unavailable.";
export const PASSWORD_RESET_INVALID_INPUT = "Enter a valid password and confirmation.";
export const PASSWORD_RESET_SUCCEEDED = "Your password has been updated. You can now sign in.";

export type AuthFailureReason =
  "invalid_input" | "invalid_credentials" | "rate_limited" | "unavailable" | "suspended";

export type PasswordResetFailureReason =
  "invalid_input" | "invalid_session" | "expired" | "rate_limited" | "unavailable";

export function userSafeLoginMessage(reason: AuthFailureReason): string {
  switch (reason) {
    case "rate_limited":
      return LOGIN_RATE_LIMITED;
    case "unavailable":
      return LOGIN_UNAVAILABLE;
    case "suspended":
      return ACCOUNT_SUSPENDED;
    case "invalid_input":
    case "invalid_credentials":
      return GENERIC_LOGIN_FAILURE;
  }
}

export function userSafePasswordResetMessage(reason: PasswordResetFailureReason): string {
  switch (reason) {
    case "rate_limited":
      return PASSWORD_RECOVERY_RATE_LIMITED;
    case "unavailable":
      return PASSWORD_RESET_UNAVAILABLE;
    case "expired":
      return PASSWORD_RESET_EXPIRED_LINK;
    case "invalid_session":
      return PASSWORD_RESET_INVALID_LINK;
    case "invalid_input":
      return PASSWORD_RESET_INVALID_INPUT;
  }
}

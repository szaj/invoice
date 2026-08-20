export const GENERIC_LOGIN_FAILURE = "Invalid email or password.";
export const LOGIN_UNAVAILABLE = "Sign in is temporarily unavailable.";
export const LOGIN_RATE_LIMITED = "Too many sign-in attempts. Try again later.";
export const GENERIC_LOGOUT_FAILURE = "Sign out is temporarily unavailable.";

export type AuthFailureReason =
  "invalid_input" | "invalid_credentials" | "rate_limited" | "unavailable";

export function userSafeLoginMessage(reason: AuthFailureReason): string {
  switch (reason) {
    case "rate_limited":
      return LOGIN_RATE_LIMITED;
    case "unavailable":
      return LOGIN_UNAVAILABLE;
    case "invalid_input":
    case "invalid_credentials":
      return GENERIC_LOGIN_FAILURE;
  }
}

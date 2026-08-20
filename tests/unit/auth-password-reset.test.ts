import { describe, expect, it } from "vitest";

import {
  GENERIC_PASSWORD_RECOVERY_RESPONSE,
  PASSWORD_RESET_INVALID_LINK,
  userSafePasswordResetMessage,
} from "@/domain/auth/errors";
import {
  forgotPasswordSchema,
  MIN_PASSWORD_LENGTH,
  resetPasswordSchema,
} from "@/domain/auth/password-schema";
import { classifyRecoveryCallback } from "@/domain/auth/recovery-callback";
import {
  buildRecoveryCallbackUrl,
  DEFAULT_LOCAL_APP_URL,
  getApplicationBaseUrl,
  resolveTrustedAppPath,
} from "@/domain/auth/redirect";

describe("forgotPasswordSchema", () => {
  it("accepts and normalizes a valid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "  Admin@Example.COM " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("admin@example.com");
    }
  });

  it("rejects an invalid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({}).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts a matching password of the minimum length", () => {
    const password = "a".repeat(MIN_PASSWORD_LENGTH);
    const result = resetPasswordSchema.safeParse({ password, confirmPassword: password });
    expect(result.success).toBe(true);
  });

  it("requires a password", () => {
    const result = resetPasswordSchema.safeParse({ password: "", confirmPassword: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than the documented minimum", () => {
    const result = resetPasswordSchema.safeParse({
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a confirmation mismatch", () => {
    const result = resetPasswordSchema.safeParse({
      password: "long-enough-password",
      confirmPassword: "different-password",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === "Passwords do not match")).toBe(
        true,
      );
    }
  });

  it("requires confirmation", () => {
    const result = resetPasswordSchema.safeParse({
      password: "long-enough-password",
      confirmPassword: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("trusted recovery redirects", () => {
  it("uses the configured application base URL", () => {
    expect(
      getApplicationBaseUrl({
        appUrl: "https://invoices.example.com/",
        appEnv: "production",
      }),
    ).toBe("https://invoices.example.com");
    expect(buildRecoveryCallbackUrl("https://invoices.example.com")).toBe(
      "https://invoices.example.com/auth/callback",
    );
  });

  it("defaults to localhost only in local environments", () => {
    expect(getApplicationBaseUrl({ appEnv: "local" })).toBe(DEFAULT_LOCAL_APP_URL);
    expect(() => getApplicationBaseUrl({ appEnv: "production" })).toThrow(/APP_URL is required/);
  });

  it("rejects arbitrary and off-origin redirect targets", () => {
    expect(resolveTrustedAppPath("https://evil.example/phish", "/reset-password")).toBe(
      "/reset-password",
    );
    expect(resolveTrustedAppPath("//evil.example", "/reset-password")).toBe("/reset-password");
    expect(resolveTrustedAppPath("/\\evil.example", "/reset-password")).toBe("/reset-password");
    expect(resolveTrustedAppPath("/signup", "/reset-password")).toBe("/reset-password");
    expect(resolveTrustedAppPath("/reset-password", "/login")).toBe("/reset-password");
    expect(resolveTrustedAppPath(null, "/reset-password")).toBe("/reset-password");
  });
});

describe("recovery callback classification", () => {
  it("accepts a PKCE code without exposing it in the classification", () => {
    const classified = classifyRecoveryCallback({ code: "secret-recovery-code" });
    expect(classified).toEqual({ kind: "pkce" });
    expect(JSON.stringify(classified)).not.toContain("secret-recovery-code");
  });

  it("accepts a recovery OTP hash without returning the token", () => {
    const classified = classifyRecoveryCallback({
      token_hash: "secret-token-hash",
      type: "recovery",
    });
    expect(classified).toEqual({ kind: "otp" });
    expect(JSON.stringify(classified)).not.toContain("secret-token-hash");
  });

  it("classifies expired, invalid, and malformed callbacks", () => {
    expect(classifyRecoveryCallback({ error_code: "otp_expired" }).kind).toBe("expired");
    expect(classifyRecoveryCallback({ error: "access_denied" }).kind).toBe("invalid");
    expect(classifyRecoveryCallback({ token_hash: "x", type: "signup" }).kind).toBe("invalid");
    expect(classifyRecoveryCallback({}).kind).toBe("malformed");
  });
});

describe("user-safe recovery errors", () => {
  it("does not reveal whether an account exists", () => {
    expect(GENERIC_PASSWORD_RECOVERY_RESPONSE.toLowerCase()).not.toMatch(/no (user|account)/i);
    expect(userSafePasswordResetMessage("invalid_session")).toBe(PASSWORD_RESET_INVALID_LINK);
  });
});

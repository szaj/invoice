import { describe, expect, it } from "vitest";

import { loginSchema } from "@/domain/auth/login-schema";
import { GENERIC_LOGIN_FAILURE, userSafeLoginMessage } from "@/domain/auth/errors";
import { displayNameFromEmail, identityFromAuthUser } from "@/domain/auth/identity";

describe("loginSchema", () => {
  it("accepts a valid email and password and normalizes email", () => {
    const result = loginSchema.safeParse({
      email: "  Admin@Example.COM ",
      password: "secret-password",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("admin@example.com");
      expect(result.data.password).toBe("secret-password");
    }
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "secret-password",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "admin@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
  });
});

describe("identity mapping helpers", () => {
  it("derives a stable display name from email", () => {
    expect(displayNameFromEmail("ada@example.com")).toBe("ada");
  });

  it("returns identity only when id and email exist", () => {
    expect(identityFromAuthUser(null)).toBeNull();
    expect(identityFromAuthUser({ id: "user-1" })).toBeNull();
    expect(identityFromAuthUser({ id: "user-1", email: "ada@example.com" })).toEqual({
      authUserId: "user-1",
      email: "ada@example.com",
    });
  });

  it("does not read role or company fields from auth users", () => {
    const identity = identityFromAuthUser({
      id: "user-1",
      email: "ada@example.com",
      user_metadata: { role: "Admin" },
      app_metadata: { company_id: "co-1" },
    } as { id: string; email: string });

    expect(identity).toEqual({
      authUserId: "user-1",
      email: "ada@example.com",
    });
    expect(identity).not.toHaveProperty("role");
    expect(identity).not.toHaveProperty("company_id");
  });
});

describe("user-safe auth errors", () => {
  it("does not reveal whether an email exists", () => {
    expect(userSafeLoginMessage("invalid_credentials")).toBe(GENERIC_LOGIN_FAILURE);
    expect(userSafeLoginMessage("invalid_input")).toBe(GENERIC_LOGIN_FAILURE);
    expect(userSafeLoginMessage("invalid_credentials")).not.toMatch(/no account/i);
  });
});

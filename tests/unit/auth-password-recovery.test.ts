import { describe, expect, it } from "vitest";

import {
  GENERIC_PASSWORD_RECOVERY_RESPONSE,
  PASSWORD_RECOVERY_RATE_LIMITED,
  PASSWORD_RESET_INVALID_INPUT,
  PASSWORD_RESET_INVALID_LINK,
} from "@/domain/auth/errors";
import type { ApplicationUserIdentity, AuthenticatedIdentity } from "@/domain/auth/identity";
import { requestPasswordRecovery } from "@/server/auth/password-recovery";
import { updatePasswordWithSession } from "@/server/auth/password-update";
import { MemoryPasswordResetRateLimiter } from "@/server/auth/rate-limit";
import type { UserIdentityStore } from "@/server/auth/identity-repository";

const identity: AuthenticatedIdentity = {
  authUserId: "11111111-1111-1111-1111-111111111111",
  email: "ada@example.com",
};

const mappedUser: ApplicationUserIdentity = {
  id: "app-user-1",
  name: "ada",
  email: identity.email,
  supabaseAuthUserId: identity.authUserId,
  lastLoginAt: new Date("2026-08-20T00:00:00.000Z"),
  passwordResetRequired: false,
};

function createStore(
  user: ApplicationUserIdentity | null = mappedUser,
): UserIdentityStore & { cleared: string[] } {
  const store = {
    cleared: [] as string[],
    async linkAuthenticatedIdentity() {
      return user ?? mappedUser;
    },
    async findByAuthUserId() {
      return user;
    },
    async clearPasswordResetRequired(authUserId: string) {
      store.cleared.push(authUserId);
    },
    async getStatusByAuthUserId() {
      return user?.id ? ("ACTIVE" as const) : null;
    },
  };
  return store;
}

describe("requestPasswordRecovery", () => {
  it("returns a generic success message that does not enumerate accounts", async () => {
    const requestedEmails: string[] = [];
    const result = await requestPasswordRecovery(
      { email: "ada@example.com" },
      {
        rateLimiter: new MemoryPasswordResetRateLimiter(),
        recoveryProvider: {
          async requestPasswordRecovery(input) {
            requestedEmails.push(input.email);
            expect(input.redirectTo).toBe("http://localhost:3000/auth/callback");
            return { ok: true };
          },
        },
        clientKey: "127.0.0.1",
        appEnv: "local",
      },
    );

    expect(result).toEqual({
      ok: true,
      message: GENERIC_PASSWORD_RECOVERY_RESPONSE,
    });
    expect(result.ok && result.message.toLowerCase()).not.toMatch(/no (user|account)/);
    expect(requestedEmails).toEqual(["ada@example.com"]);
  });

  it("uses the trusted application URL rather than a client-supplied redirect", async () => {
    let redirectTo = "";
    await requestPasswordRecovery(
      { email: "ada@example.com", redirectTo: "https://evil.example/phish" },
      {
        rateLimiter: new MemoryPasswordResetRateLimiter(),
        recoveryProvider: {
          async requestPasswordRecovery(input) {
            redirectTo = input.redirectTo;
            return { ok: true };
          },
        },
        clientKey: "127.0.0.1",
        appUrl: "https://invoices.example.com",
        appEnv: "production",
      },
    );

    expect(redirectTo).toBe("https://invoices.example.com/auth/callback");
    expect(redirectTo).not.toContain("evil.example");
  });

  it("rate-limits repeated recovery requests", async () => {
    const deps = {
      rateLimiter: new MemoryPasswordResetRateLimiter(1, 60_000, () => 1_000),
      recoveryProvider: {
        async requestPasswordRecovery() {
          return { ok: true as const };
        },
      },
      clientKey: "203.0.113.10",
      appEnv: "local" as const,
    };

    await requestPasswordRecovery({ email: "ada@example.com" }, deps);
    const blocked = await requestPasswordRecovery({ email: "ada@example.com" }, deps);

    expect(blocked).toEqual({
      ok: false,
      reason: "rate_limited",
      error: PASSWORD_RECOVERY_RATE_LIMITED,
    });
  });

  it("still returns a generic success when the identity provider fails", async () => {
    const result = await requestPasswordRecovery(
      { email: "ada@example.com" },
      {
        rateLimiter: new MemoryPasswordResetRateLimiter(),
        recoveryProvider: {
          async requestPasswordRecovery() {
            return { ok: false, reason: "unavailable" };
          },
        },
        clientKey: "127.0.0.1",
        appEnv: "local",
      },
    );

    expect(result).toEqual({
      ok: true,
      message: GENERIC_PASSWORD_RECOVERY_RESPONSE,
    });
  });
});

describe("updatePasswordWithSession", () => {
  it("rejects confirmation mismatch before calling the identity provider", async () => {
    let updates = 0;
    const result = await updatePasswordWithSession(
      { password: "long-enough-password", confirmPassword: "different-password" },
      {
        identityProvider: {
          async getIdentity() {
            return identity;
          },
          async updatePassword() {
            updates += 1;
            return { ok: true };
          },
          async signOut() {},
        },
        identityStore: createStore(),
        async hasRecoverySession() {
          return true;
        },
        async clearRecoverySession() {},
      },
    );

    expect(result).toEqual({
      ok: false,
      reason: "invalid_input",
      error: PASSWORD_RESET_INVALID_INPUT,
    });
    expect(updates).toBe(0);
  });

  it("rejects an invalid or missing recovery session", async () => {
    const result = await updatePasswordWithSession(
      { password: "long-enough-password", confirmPassword: "long-enough-password" },
      {
        identityProvider: {
          async getIdentity() {
            return identity;
          },
          async updatePassword() {
            return { ok: true };
          },
          async signOut() {},
        },
        identityStore: createStore({ ...mappedUser, passwordResetRequired: false }),
        async hasRecoverySession() {
          return false;
        },
        async clearRecoverySession() {},
      },
    );

    expect(result).toEqual({
      ok: false,
      reason: "invalid_session",
      error: PASSWORD_RESET_INVALID_LINK,
    });
  });

  it("updates the password for a valid recovery session and signs out", async () => {
    const store = createStore();
    let signedOut = 0;
    let clearedMarker = 0;
    const result = await updatePasswordWithSession(
      { password: "long-enough-password", confirmPassword: "long-enough-password" },
      {
        identityProvider: {
          async getIdentity() {
            return identity;
          },
          async updatePassword(password) {
            expect(password).toBe("long-enough-password");
            return { ok: true };
          },
          async signOut() {
            signedOut += 1;
          },
        },
        identityStore: store,
        async hasRecoverySession() {
          return true;
        },
        async clearRecoverySession() {
          clearedMarker += 1;
        },
      },
    );

    expect(result).toEqual({ ok: true });
    expect(store.cleared).toEqual([identity.authUserId]);
    expect(signedOut).toBe(1);
    expect(clearedMarker).toBe(1);
  });

  it("allows a password-reset-required application user without a recovery cookie", async () => {
    const store = createStore({ ...mappedUser, passwordResetRequired: true });
    const result = await updatePasswordWithSession(
      { password: "long-enough-password", confirmPassword: "long-enough-password" },
      {
        identityProvider: {
          async getIdentity() {
            return identity;
          },
          async updatePassword() {
            return { ok: true };
          },
          async signOut() {},
        },
        identityStore: store,
        async hasRecoverySession() {
          return false;
        },
        async clearRecoverySession() {},
      },
    );

    expect(result).toEqual({ ok: true });
    expect(store.cleared).toEqual([identity.authUserId]);
  });
});

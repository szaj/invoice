import { describe, expect, it } from "vitest";

import { GENERIC_LOGIN_FAILURE, LOGIN_RATE_LIMITED, LOGIN_UNAVAILABLE } from "@/domain/auth/errors";
import { loginWithPassword, type PasswordIdentityProvider } from "@/server/auth/login";
import { MemoryLoginRateLimiter } from "@/server/auth/rate-limit";
import type { ApplicationUserIdentity } from "@/domain/auth/identity";
import type { UserIdentityStore } from "@/server/auth/identity-repository";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

const mappedUser: ApplicationUserIdentity = {
  id: "app-user-1",
  name: "ada",
  email: "ada@example.com",
  supabaseAuthUserId: "11111111-1111-1111-1111-111111111111",
  lastLoginAt: new Date("2026-08-20T00:00:00.000Z"),
  passwordResetRequired: false,
};

function auditWriter() {
  return createMemoryAuditWriter();
}

function createProvider(
  result: Awaited<ReturnType<PasswordIdentityProvider["signInWithPassword"]>>,
): PasswordIdentityProvider & { signOutCalls: number } {
  const provider = {
    signOutCalls: 0,
    async signInWithPassword() {
      return result;
    },
    async signOut() {
      provider.signOutCalls += 1;
    },
  };
  return provider;
}

function createStore(): UserIdentityStore & { links: number } {
  const store = {
    links: 0,
    async linkAuthenticatedIdentity() {
      store.links += 1;
      return mappedUser;
    },
    async findByAuthUserId() {
      return mappedUser;
    },
    async clearPasswordResetRequired() {},
    async getStatusByAuthUserId() {
      return "ACTIVE" as const;
    },
  };
  return store;
}

describe("loginWithPassword", () => {
  it("maps a valid identity after successful authentication", async () => {
    const provider = createProvider({
      ok: true,
      identity: { authUserId: mappedUser.supabaseAuthUserId, email: mappedUser.email },
    });
    const store = createStore();

    const result = await loginWithPassword(
      { email: "ada@example.com", password: "correct-horse" },
      {
        rateLimiter: new MemoryLoginRateLimiter(),
        identityProvider: provider,
        identityStore: store,
        clientKey: "127.0.0.1",
        auditWriter: auditWriter(),
      },
    );

    expect(result).toEqual({ ok: true, user: mappedUser });
    expect(store.links).toBe(1);
    expect(provider.signOutCalls).toBe(0);
  });

  it("returns a generic failure for invalid credentials", async () => {
    const result = await loginWithPassword(
      { email: "ada@example.com", password: "wrong" },
      {
        rateLimiter: new MemoryLoginRateLimiter(),
        identityProvider: createProvider({ ok: false, reason: "invalid_credentials" }),
        identityStore: createStore(),
        clientKey: "127.0.0.1",
        auditWriter: auditWriter(),
      },
    );

    expect(result).toEqual({
      ok: false,
      reason: "invalid_credentials",
      error: GENERIC_LOGIN_FAILURE,
    });
    expect(result.ok === false && result.error).not.toMatch(/no account/i);
  });

  it("returns a generic failure for malformed input", async () => {
    const result = await loginWithPassword(
      { email: "not-an-email", password: "x" },
      {
        rateLimiter: new MemoryLoginRateLimiter(),
        identityProvider: createProvider({ ok: false, reason: "invalid_credentials" }),
        identityStore: createStore(),
        clientKey: "127.0.0.1",
        auditWriter: auditWriter(),
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_input");
      expect(result.error).toBe(GENERIC_LOGIN_FAILURE);
    }
  });

  it("rate-limits repeated login attempts", async () => {
    const limiter = new MemoryLoginRateLimiter(2, 60_000, () => 1_000);
    const deps = {
      rateLimiter: limiter,
      identityProvider: createProvider({ ok: false, reason: "invalid_credentials" }),
      identityStore: createStore(),
      clientKey: "203.0.113.10",
      auditWriter: auditWriter(),
    };

    await loginWithPassword({ email: "ada@example.com", password: "wrong" }, deps);
    await loginWithPassword({ email: "ada@example.com", password: "wrong" }, deps);
    const blocked = await loginWithPassword({ email: "ada@example.com", password: "wrong" }, deps);

    expect(blocked).toEqual({
      ok: false,
      reason: "rate_limited",
      error: LOGIN_RATE_LIMITED,
    });
  });

  it("treats identity-provider outages as unavailable", async () => {
    const result = await loginWithPassword(
      { email: "ada@example.com", password: "correct-horse" },
      {
        rateLimiter: new MemoryLoginRateLimiter(),
        identityProvider: createProvider({ ok: false, reason: "unavailable" }),
        identityStore: createStore(),
        clientKey: "127.0.0.1",
        auditWriter: auditWriter(),
      },
    );

    expect(result).toEqual({
      ok: false,
      reason: "unavailable",
      error: LOGIN_UNAVAILABLE,
    });
  });

  it("clears the session if identity mapping fails", async () => {
    const provider = createProvider({
      ok: true,
      identity: { authUserId: mappedUser.supabaseAuthUserId, email: mappedUser.email },
    });
    const result = await loginWithPassword(
      { email: "ada@example.com", password: "correct-horse" },
      {
        rateLimiter: new MemoryLoginRateLimiter(),
        identityProvider: provider,
        identityStore: {
          async linkAuthenticatedIdentity() {
            throw new Error("db down");
          },
          async findByAuthUserId() {
            return null;
          },
          async clearPasswordResetRequired() {},
          async getStatusByAuthUserId() {
            return null;
          },
        },
        clientKey: "127.0.0.1",
        auditWriter: auditWriter(),
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unavailable");
    }
    expect(provider.signOutCalls).toBe(1);
  });

  it("rejects suspended application users after authentication", async () => {
    const provider = createProvider({
      ok: true,
      identity: { authUserId: mappedUser.supabaseAuthUserId, email: mappedUser.email },
    });
    const result = await loginWithPassword(
      { email: "ada@example.com", password: "correct-horse" },
      {
        rateLimiter: new MemoryLoginRateLimiter(),
        identityProvider: provider,
        identityStore: {
          ...createStore(),
          async getStatusByAuthUserId() {
            return "SUSPENDED";
          },
        },
        clientKey: "127.0.0.1",
        auditWriter: auditWriter(),
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("suspended");
    }
    expect(provider.signOutCalls).toBe(1);
  });
});

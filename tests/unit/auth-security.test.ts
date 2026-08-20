import { describe, expect, it } from "vitest";

import {
  isAuthenticatedAuthEntryPath,
  isLoginPagePath,
  isPublicAuthPath,
  requiresHttps,
  supabaseCookieOptions,
} from "@/domain/auth/https";
import {
  MemoryLoginRateLimiter,
  MemoryPasswordResetRateLimiter,
  loginRateLimitKey,
  passwordResetRateLimitKey,
} from "@/server/auth/rate-limit";

describe("HTTPS cookie policy", () => {
  it("allows HTTP cookies only in local environments", () => {
    expect(requiresHttps("local")).toBe(false);
    expect(requiresHttps("development")).toBe(true);
    expect(requiresHttps("staging")).toBe(true);
    expect(requiresHttps("production")).toBe(true);
    expect(supabaseCookieOptions("local").secure).toBe(false);
    expect(supabaseCookieOptions("production").secure).toBe(true);
  });
});

describe("public auth paths", () => {
  it("allows login UI and auth APIs without a session", () => {
    expect(isPublicAuthPath("/login")).toBe(true);
    expect(isPublicAuthPath("/forgot-password")).toBe(true);
    expect(isPublicAuthPath("/reset-password")).toBe(true);
    expect(isPublicAuthPath("/auth/callback")).toBe(true);
    expect(isPublicAuthPath("/api/auth/login")).toBe(true);
    expect(isPublicAuthPath("/api/auth/logout")).toBe(true);
    expect(isPublicAuthPath("/api/auth/forgot-password")).toBe(true);
    expect(isPublicAuthPath("/api/auth/reset-password")).toBe(true);
    expect(isPublicAuthPath("/")).toBe(false);
    expect(isPublicAuthPath("/signup")).toBe(false);
    expect(isLoginPagePath("/login")).toBe(true);
    expect(isLoginPagePath("/api/auth/login")).toBe(false);
    expect(isAuthenticatedAuthEntryPath("/login")).toBe(true);
    expect(isAuthenticatedAuthEntryPath("/forgot-password")).toBe(true);
    expect(isAuthenticatedAuthEntryPath("/reset-password")).toBe(false);
  });
});

describe("MemoryLoginRateLimiter", () => {
  it("allows requests under the limit and then blocks", async () => {
    const limiter = new MemoryLoginRateLimiter(2, 1_000, () => 0);
    const key = loginRateLimitKey("127.0.0.1");

    expect((await limiter.consume(key)).allowed).toBe(true);
    expect((await limiter.consume(key)).allowed).toBe(true);
    expect((await limiter.consume(key)).allowed).toBe(false);
  });
});

describe("MemoryPasswordResetRateLimiter", () => {
  it("allows requests under the limit and then blocks", async () => {
    const limiter = new MemoryPasswordResetRateLimiter(2, 1_000, () => 0);
    const key = passwordResetRateLimitKey("127.0.0.1");

    expect((await limiter.consume(key)).allowed).toBe(true);
    expect((await limiter.consume(key)).allowed).toBe(true);
    expect((await limiter.consume(key)).allowed).toBe(false);
  });
});

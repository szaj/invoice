import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { maskSensitiveAuditValues } from "@/domain/audit/mask";
import { AUDIT_APPEND_ONLY_MESSAGE, AuditActions } from "@/domain/audit/types";
import { AppendOnlyAuditWriter, recordAuditEventBestEffort } from "@/server/audit/audit-service";
import { loginWithPassword, type PasswordIdentityProvider } from "@/server/auth/login";
import { MemoryLoginRateLimiter } from "@/server/auth/rate-limit";
import type { ApplicationUserIdentity } from "@/domain/auth/identity";
import type { UserIdentityStore } from "@/server/auth/identity-repository";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

const mappedUser: ApplicationUserIdentity = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "ada",
  email: "ada@example.com",
  supabaseAuthUserId: "22222222-2222-4222-8222-222222222222",
  lastLoginAt: new Date("2026-08-20T00:00:00.000Z"),
  passwordResetRequired: false,
};

describe("audit masking", () => {
  it("redacts passwords, tokens, and gateway secrets", () => {
    const masked = maskSensitiveAuditValues({
      email: "ada@example.com",
      password: "secret-password",
      nested: { apiKey: "sk_live", webhookSecret: "whsec", status: "ACTIVE" },
      cardNumber: "4111111111111111",
    });

    expect(masked).toEqual({
      email: "ada@example.com",
      password: "[Redacted]",
      nested: { apiKey: "[Redacted]", webhookSecret: "[Redacted]", status: "ACTIVE" },
      cardNumber: "[Redacted]",
    });
  });
});

describe("append-only audit writer", () => {
  it("appends events and rejects update/delete", async () => {
    const memory = createMemoryAuditWriter();
    const writer = new AppendOnlyAuditWriter({
      store: {
        async append(input) {
          return memory.append(input);
        },
      },
    });

    const created = await writer.append({
      actorType: "SYSTEM",
      entityType: "session",
      action: AuditActions.LOGIN_FAILED,
      newValues: { password: "should-mask", reason: "invalid_credentials" },
    });

    expect(created.action).toBe(AuditActions.LOGIN_FAILED);
    expect(created.newValues).toEqual({
      password: "[Redacted]",
      reason: "invalid_credentials",
    });
    expect(memory.events).toHaveLength(1);

    expect(() => writer.update()).toThrow(AUDIT_APPEND_ONLY_MESSAGE);
    expect(() => writer.delete()).toThrow(AUDIT_APPEND_ONLY_MESSAGE);
  });

  it("best-effort recording does not throw when the store fails", async () => {
    await expect(
      recordAuditEventBestEffort(
        {
          actorType: "SYSTEM",
          entityType: "session",
          action: AuditActions.LOGIN_FAILED,
        },
        {
          async append() {
            throw new Error("db down");
          },
        },
      ),
    ).resolves.toBeUndefined();
  });
});

describe("login audit writes", () => {
  it("writes an audit event on successful login", async () => {
    const auditWriter = createMemoryAuditWriter();
    const provider: PasswordIdentityProvider = {
      async signInWithPassword() {
        return {
          ok: true,
          identity: { authUserId: mappedUser.supabaseAuthUserId, email: mappedUser.email },
        };
      },
      async signOut() {},
    };
    const store: UserIdentityStore = {
      async linkAuthenticatedIdentity() {
        return mappedUser;
      },
      async findByAuthUserId() {
        return mappedUser;
      },
      async clearPasswordResetRequired() {},
      async getStatusByAuthUserId() {
        return "ACTIVE";
      },
    };

    const result = await loginWithPassword(
      { email: "ada@example.com", password: "correct-horse" },
      {
        rateLimiter: new MemoryLoginRateLimiter(),
        identityProvider: provider,
        identityStore: store,
        clientKey: "203.0.113.10",
        userAgent: "vitest",
        auditWriter,
      },
    );

    expect(result.ok).toBe(true);
    expect(auditWriter.events).toHaveLength(1);
    expect(auditWriter.events[0]?.action).toBe(AuditActions.LOGIN_SUCCEEDED);
    expect(auditWriter.events[0]?.actorUserId).toBe(mappedUser.id);
    expect(auditWriter.events[0]?.ipAddress).toBe("203.0.113.10");
    expect(auditWriter.events[0]?.userAgent).toBe("vitest");
  });

  it("writes a failure audit event without storing the password", async () => {
    const auditWriter = createMemoryAuditWriter();
    const result = await loginWithPassword(
      { email: "ada@example.com", password: "wrong-password" },
      {
        rateLimiter: new MemoryLoginRateLimiter(),
        identityProvider: {
          async signInWithPassword() {
            return { ok: false, reason: "invalid_credentials" };
          },
          async signOut() {},
        },
        identityStore: {
          async linkAuthenticatedIdentity() {
            return mappedUser;
          },
          async findByAuthUserId() {
            return mappedUser;
          },
          async clearPasswordResetRequired() {},
          async getStatusByAuthUserId() {
            return "ACTIVE";
          },
        },
        clientKey: "203.0.113.10",
        auditWriter,
      },
    );

    expect(result.ok).toBe(false);
    expect(auditWriter.events).toHaveLength(1);
    expect(auditWriter.events[0]?.action).toBe(AuditActions.LOGIN_FAILED);
    expect(JSON.stringify(auditWriter.events[0])).not.toMatch(/wrong-password/);
  });
});

describe("audit API surface", () => {
  it("does not expose update or delete audit HTTP routes", () => {
    const apiRoot = path.join(process.cwd(), "src", "app", "api");
    const auditApi = path.join(apiRoot, "audit");
    expect(existsSync(auditApi)).toBe(false);

    const routeFiles = collectRouteFiles(apiRoot);
    for (const file of routeFiles) {
      const contents = readFileSync(file, "utf8");
      expect(contents).not.toMatch(/auditLog\.(update|delete)/i);
      expect(contents).not.toMatch(/prisma\.auditLog\.(update|delete|deleteMany|updateMany)/i);
    }
  });
});

function collectRouteFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectRouteFiles(full));
    } else if (entry.name === "route.ts") {
      files.push(full);
    }
  }
  return files;
}

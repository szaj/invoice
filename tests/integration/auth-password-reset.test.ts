import { afterAll, describe, expect, it } from "vitest";

import { GENERIC_PASSWORD_RECOVERY_RESPONSE } from "@/domain/auth/errors";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("password reset required flag", () => {
  it("records the password_reset_required migration when applied", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name = '20260820200000_password_reset_required'
    `;

    expect(rows).toHaveLength(1);
  });

  it("stores password_reset_required as a workflow flag, not a credential", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const { PrismaUserIdentityStore } = await import("@/server/auth/identity-repository");
    const prisma = getPrisma();
    const store = new PrismaUserIdentityStore();
    const supabaseAuthUserId = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

    await prisma.user.deleteMany({ where: { supabaseAuthUserId } });

    const linked = await store.linkAuthenticatedIdentity({
      supabaseAuthUserId,
      email: "reset-flag@example.com",
    });

    expect(linked.passwordResetRequired).toBe(false);

    await prisma.user.update({
      where: { id: linked.id },
      data: { passwordResetRequired: true },
    });

    const required = await store.findByAuthUserId(supabaseAuthUserId);
    expect(required?.passwordResetRequired).toBe(true);

    await store.clearPasswordResetRequired(supabaseAuthUserId);
    const cleared = await store.findByAuthUserId(supabaseAuthUserId);
    expect(cleared?.passwordResetRequired).toBe(false);

    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
    `;
    const columnNames = columns.map((column) => column.column_name);
    expect(columnNames).toContain("password_reset_required");
    expect(columnNames).not.toContain("password");
    expect(columnNames).not.toContain("password_hash");
    expect(columnNames).not.toContain("reset_token");

    await prisma.user.deleteMany({ where: { supabaseAuthUserId } });
  });

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }

    const { getPrisma } = await import("@/server/db/client");
    await getPrisma().$disconnect();
  });
});

const runAuthIntegration =
  process.env.RUN_AUTH_INTEGRATION === "true" &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  Boolean(process.env.AUTH_TEST_EMAIL);

describe.skipIf(!runAuthIntegration)("supabase password recovery request", () => {
  it("returns the same generic message for known and unknown emails", async () => {
    const email = process.env.AUTH_TEST_EMAIL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!email || !supabaseUrl || !anonKey) {
      throw new Error("Live recovery environment is incomplete");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const { requestPasswordRecovery } = await import("@/server/auth/password-recovery");
    const { MemoryPasswordResetRateLimiter } = await import("@/server/auth/rate-limit");

    const client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const deps = {
      rateLimiter: new MemoryPasswordResetRateLimiter(),
      recoveryProvider: {
        async requestPasswordRecovery(input: { email: string; redirectTo: string }) {
          const { error } = await client.auth.resetPasswordForEmail(input.email, {
            redirectTo: input.redirectTo,
          });
          if (error) {
            return { ok: false as const, reason: "unavailable" as const };
          }
          return { ok: true as const };
        },
      },
      clientKey: "live-recovery-verification",
      appEnv: "local" as const,
    };

    const known = await requestPasswordRecovery({ email }, deps);
    const unknown = await requestPasswordRecovery(
      { email: `does-not-exist-${Date.now()}@example.invalid` },
      deps,
    );

    expect(known.ok).toBe(true);
    expect(unknown.ok).toBe(true);
    if (known.ok) {
      expect(known.message).toBe(GENERIC_PASSWORD_RECOVERY_RESPONSE);
      expect(known.message.toLowerCase()).not.toMatch(/no (user|account)/);
    }
    if (unknown.ok) {
      expect(unknown.message).toBe(GENERIC_PASSWORD_RECOVERY_RESPONSE);
    }
  });
});

const runPasswordUpdateIntegration = runAuthIntegration && Boolean(process.env.AUTH_TEST_PASSWORD);

describe.skipIf(!runPasswordUpdateIntegration)("supabase password update", () => {
  it("updates the password for an authenticated session and restores the original", async () => {
    const email = process.env.AUTH_TEST_EMAIL;
    const password = process.env.AUTH_TEST_PASSWORD;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!email || !password || !supabaseUrl || !anonKey) {
      throw new Error("Live password-update environment is incomplete");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const { updatePasswordWithSession } = await import("@/server/auth/password-update");
    const { identityFromAuthUser } = await import("@/domain/auth/identity");

    const client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const rotated = `${password}-rotated`;

    const signIn = await client.auth.signInWithPassword({ email, password });
    expect(signIn.error).toBeNull();
    expect(signIn.data.user?.id).toBeTruthy();

    const identity = identityFromAuthUser(signIn.data.user);
    expect(identity).not.toHaveProperty("role");
    expect(identity).not.toHaveProperty("company_id");

    try {
      const updated = await updatePasswordWithSession(
        { password: rotated, confirmPassword: rotated },
        {
          identityProvider: {
            async getIdentity() {
              const { data } = await client.auth.getUser();
              return identityFromAuthUser(data.user);
            },
            async updatePassword(nextPassword) {
              const { error } = await client.auth.updateUser({ password: nextPassword });
              if (error) {
                return { ok: false as const, reason: "unavailable" as const };
              }
              return { ok: true as const };
            },
            async signOut() {
              await client.auth.signOut();
            },
          },
          identityStore: {
            async linkAuthenticatedIdentity() {
              throw new Error("not used");
            },
            async findByAuthUserId() {
              return {
                id: "live-app-user",
                name: "test",
                email,
                supabaseAuthUserId: identity?.authUserId ?? "",
                lastLoginAt: null,
                passwordResetRequired: false,
              };
            },
            async clearPasswordResetRequired() {},
            async getStatusByAuthUserId() {
              return "ACTIVE" as const;
            },
          },
          async hasRecoverySession() {
            return true;
          },
          async clearRecoverySession() {},
        },
      );

      expect(updated.ok).toBe(true);

      const afterReset = await client.auth.getUser();
      expect(afterReset.data.user).toBeNull();

      const rotatedSignIn = await client.auth.signInWithPassword({ email, password: rotated });
      expect(rotatedSignIn.error).toBeNull();
    } finally {
      const current = await client.auth.getUser();
      if (!current.data.user) {
        const restoreSignIn = await client.auth.signInWithPassword({ email, password: rotated });
        if (restoreSignIn.error) {
          await client.auth.signInWithPassword({ email, password });
        }
      }

      await client.auth.updateUser({ password });
      await client.auth.signOut();
    }
  });
});

const runRecoveryLinkIntegration =
  process.env.RUN_RECOVERY_INTEGRATION === "true" &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.AUTH_TEST_EMAIL);

describe.skipIf(!runRecoveryLinkIntegration)("supabase recovery link", () => {
  it("exchanges a generated recovery link and rejects reuse", async () => {
    const email = process.env.AUTH_TEST_EMAIL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!email || !supabaseUrl || !serviceRole) {
      throw new Error("Live recovery-link environment is incomplete");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const { classifyRecoveryCallback } = await import("@/domain/auth/recovery-callback");

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const generated = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    expect(generated.error).toBeNull();
    const properties = generated.data.properties;
    expect(properties?.hashed_token).toBeTruthy();

    const classified = classifyRecoveryCallback({
      token_hash: properties?.hashed_token,
      type: "recovery",
    });
    expect(classified.kind).toBe("otp");
    expect(JSON.stringify(classified)).not.toContain(properties?.hashed_token);

    const userClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const verified = await userClient.auth.verifyOtp({
      type: "recovery",
      token_hash: properties?.hashed_token ?? "",
    });
    expect(verified.error).toBeNull();
    expect(verified.data.user?.email).toBe(email);

    const reused = await userClient.auth.verifyOtp({
      type: "recovery",
      token_hash: properties?.hashed_token ?? "",
    });
    expect(reused.error).not.toBeNull();

    await userClient.auth.signOut();
  });
});

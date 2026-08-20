import { afterAll, describe, expect, it } from "vitest";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("authentication identity mapping", () => {
  it("records the authentication_base migration when applied", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name = '20260820193000_authentication_base'
    `;

    expect(rows).toHaveLength(1);
  });

  it("stores a stable Supabase Auth user identifier on users", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const { PrismaUserIdentityStore } = await import("@/server/auth/identity-repository");
    const prisma = getPrisma();
    const store = new PrismaUserIdentityStore();
    const supabaseAuthUserId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

    await prisma.user.deleteMany({ where: { supabaseAuthUserId } });

    const first = await store.linkAuthenticatedIdentity({
      supabaseAuthUserId,
      email: "identity-map@example.com",
    });
    const second = await store.linkAuthenticatedIdentity({
      supabaseAuthUserId,
      email: "identity-map@example.com",
    });

    expect(first.id).toBe(second.id);
    expect(first.supabaseAuthUserId).toBe(supabaseAuthUserId);
    expect(first.passwordResetRequired).toBe(false);
    expect(second.lastLoginAt).not.toBeNull();

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
  Boolean(process.env.AUTH_TEST_EMAIL) &&
  Boolean(process.env.AUTH_TEST_PASSWORD);

describe.skipIf(!runAuthIntegration)("supabase auth login", () => {
  it("verifies live login, getUser, identity mapping, and logout", async () => {
    const email = process.env.AUTH_TEST_EMAIL;
    const password = process.env.AUTH_TEST_PASSWORD;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!email || !password || !supabaseUrl || !anonKey) {
      throw new Error("Live auth environment is incomplete");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const { identityFromAuthUser } = await import("@/domain/auth/identity");
    const { GENERIC_LOGIN_FAILURE } = await import("@/domain/auth/errors");
    const { loginWithPassword } = await import("@/server/auth/login");
    const { MemoryLoginRateLimiter } = await import("@/server/auth/rate-limit");
    const { PrismaUserIdentityStore } = await import("@/server/auth/identity-repository");
    const { getPrisma } = await import("@/server/db/client");

    const client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const provider = {
      async signInWithPassword(input: { email: string; password: string }) {
        const { data, error } = await client.auth.signInWithPassword(input);
        if (error || !data.user?.id || !data.user.email) {
          const status = error && "status" in error ? error.status : undefined;
          if (status === 400 || status === 401 || !data.user) {
            return { ok: false as const, reason: "invalid_credentials" as const };
          }
          return { ok: false as const, reason: "unavailable" as const };
        }
        return {
          ok: true as const,
          identity: { authUserId: data.user.id, email: data.user.email },
        };
      },
      async signOut() {
        await client.auth.signOut();
      },
    };

    const deps = {
      rateLimiter: new MemoryLoginRateLimiter(),
      identityProvider: provider,
      identityStore: new PrismaUserIdentityStore(),
      clientKey: "live-auth-verification",
    };

    const invalid = await loginWithPassword({ email, password: "not-the-test-password" }, deps);

    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.reason).toBe("invalid_credentials");
      expect(invalid.error).toBe(GENERIC_LOGIN_FAILURE);
      expect(invalid.error.toLowerCase()).not.toMatch(/no account/);
    }

    const beforeUser = await client.auth.getUser();
    expect(beforeUser.data.user).toBeNull();

    const valid = await loginWithPassword({ email, password }, deps);

    expect(valid.ok).toBe(true);
    if (!valid.ok) {
      throw new Error("Live login failed");
    }

    const sessionUser = await client.auth.getUser();
    expect(sessionUser.error).toBeNull();
    expect(sessionUser.data.user?.id).toBe(valid.user.supabaseAuthUserId);
    expect(identityFromAuthUser(sessionUser.data.user)).toEqual({
      authUserId: valid.user.supabaseAuthUserId,
      email: valid.user.email,
    });
    expect(identityFromAuthUser(sessionUser.data.user)).not.toHaveProperty("role");
    expect(identityFromAuthUser(sessionUser.data.user)).not.toHaveProperty("permissions");
    expect(identityFromAuthUser(sessionUser.data.user)).not.toHaveProperty("company_id");

    const prisma = getPrisma();
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
    `;
    const columnNames = columns.map((column) => column.column_name);

    expect(columnNames).toEqual(
      expect.arrayContaining([
        "id",
        "name",
        "email",
        "supabase_auth_user_id",
        "status",
        "role_id",
        "last_login_at",
        "password_reset_required",
        "created_at",
        "updated_at",
      ]),
    );
    expect(columnNames).not.toContain("password");
    expect(columnNames).not.toContain("password_hash");
    expect(columnNames).not.toContain("reset_token");
    expect(columnNames.some((name) => name.includes("company"))).toBe(false);
    expect(columnNames.some((name) => name.includes("permission"))).toBe(false);

    const emailNormalized = email.trim().toLowerCase();
    const prior = await prisma.user.findUnique({ where: { email: emailNormalized } });
    const priorRoleId = prior?.roleId ?? null;

    const mapped = await prisma.user.findUnique({
      where: { supabaseAuthUserId: valid.user.supabaseAuthUserId },
    });

    expect(mapped).not.toBeNull();
    expect(mapped?.email).toBe(valid.user.email);
    expect(mapped?.supabaseAuthUserId).toBe(valid.user.supabaseAuthUserId);
    expect(mapped?.lastLoginAt).not.toBeNull();
    // Login must not assign or change application roles (bootstrap/User Management own that).
    expect(mapped?.roleId).toBe(priorRoleId);
    expect(mapped).not.toHaveProperty("companyId");

    await provider.signOut();
    const afterLogout = await client.auth.getUser();
    expect(afterLogout.data.user).toBeNull();
  });
});

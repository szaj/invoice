import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  createManagedUser,
  getManagedUser,
  listManagedUsers,
  resetManagedUserPassword,
  suspendManagedUser,
  updateManagedUser,
} from "@/server/users/user-service";
import type { AuthUserProvisioning } from "@/server/users/user-repository";
import { PrismaUserManagementStore } from "@/server/users/user-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("user management integration", () => {
  const createdAuthIds: string[] = [];
  const createdUserIds: string[] = [];

  it("records the user_management migration when applied", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name = '20260820220000_user_management'
    `;
    expect(rows).toHaveLength(1);
  });

  it("supports Admin CRUD, suspend, and password-reset-required without company assignment", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });

    const actorAuthId = "cccccccc-dddd-4eee-8fff-000000000001";
    await prisma.user.deleteMany({
      where: { email: { in: ["actor-admin@example.com", "managed@example.com"] } },
    });

    const actor = await prisma.user.create({
      data: {
        name: "Actor Admin",
        email: "actor-admin@example.com",
        supabaseAuthUserId: actorAuthId,
        roleId: adminRole.id,
        status: "ACTIVE",
      },
    });
    createdUserIds.push(actor.id);

    const principal: AuthorizationPrincipal = {
      userId: actor.id,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    let nextAuthId = "cccccccc-dddd-4eee-8fff-000000000002";
    const authProvisioning: AuthUserProvisioning = {
      async createAuthUser() {
        const authUserId = nextAuthId;
        createdAuthIds.push(authUserId);
        nextAuthId = "cccccccc-dddd-4eee-8fff-000000000003";
        return { ok: true, authUserId };
      },
      async updateAuthUser() {
        return { ok: true };
      },
      async sendPasswordRecovery() {
        return { ok: true };
      },
      async deleteAuthUser() {},
    };

    const deps = {
      store: new PrismaUserManagementStore(),
      authProvisioning,
    };

    const created = await createManagedUser(
      principal,
      {
        name: "Managed User",
        email: "managed@example.com",
        roleCode: "STAFF",
        employeeId: "E-100",
        mfaEnabled: false,
        passwordResetRequired: true,
        status: "ACTIVE",
      },
      deps,
    );

    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("create failed");
    }
    createdUserIds.push(created.data.id);
    expect(created.data.roleCode).toBe("STAFF");
    expect(created.data.employeeId).toBe("E-100");
    expect(created.data.passwordResetRequired).toBe(true);
    expect(created.data).not.toHaveProperty("companyId");

    const listed = await listManagedUsers(principal, deps);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data.some((user) => user.id === created.data.id)).toBe(true);
    }

    const updated = await updateManagedUser(
      principal,
      created.data.id,
      {
        name: "Managed User Updated",
        email: "managed@example.com",
        roleCode: "COMPLIANCE",
        employeeId: "E-200",
        mfaEnabled: true,
        status: "ACTIVE",
        passwordResetRequired: false,
      },
      deps,
    );
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.roleCode).toBe("COMPLIANCE");
      expect(updated.data.mfaEnabled).toBe(true);
      expect(updated.data.passwordResetRequired).toBe(false);
    }

    const reset = await resetManagedUserPassword(principal, created.data.id, deps);
    expect(reset.ok).toBe(true);
    if (reset.ok) {
      expect(reset.data.user.passwordResetRequired).toBe(true);
    }

    const suspended = await suspendManagedUser(principal, created.data.id, deps);
    expect(suspended.ok).toBe(true);
    if (suspended.ok) {
      expect(suspended.data.status).toBe("SUSPENDED");
    }

    const fetched = await getManagedUser(principal, created.data.id, deps);
    expect(fetched.ok).toBe(true);

    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
    `;
    const names = columns.map((column) => column.column_name);
    expect(names).toEqual(
      expect.arrayContaining([
        "employee_id",
        "mfa_enabled",
        "created_by_user_id",
        "password_reset_required",
        "role_id",
      ]),
    );
    expect(names.some((name) => name.includes("company"))).toBe(false);
    expect(names).not.toContain("password");
    expect(names).not.toContain("password_hash");
  }, 30_000);

  it("denies Staff from managing users against the live permission matrix", async () => {
    const staffPrincipal: AuthorizationPrincipal = {
      userId: "staff-actor",
      status: "ACTIVE",
      roleCode: "STAFF",
    };
    const listed = await listManagedUsers(staffPrincipal, {
      store: new PrismaUserManagementStore(),
      authProvisioning: {
        async createAuthUser() {
          return { ok: false, reason: "unavailable" };
        },
        async updateAuthUser() {
          return { ok: false, reason: "unavailable" };
        },
        async sendPasswordRecovery() {
          return { ok: false, reason: "unavailable" };
        },
        async deleteAuthUser() {},
      },
    });
    expect(listed.ok).toBe(false);
    if (!listed.ok) {
      expect(listed.status).toBe(403);
    }
  });

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.user.deleteMany({
      where: { email: { in: ["actor-admin@example.com", "managed@example.com"] } },
    });
    await prisma.$disconnect();
  });
});

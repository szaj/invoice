import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { getCompany, listCompanies } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { createManagedUser, getManagedUser } from "@/server/users/user-service";
import {
  PrismaUserManagementStore,
  type AuthUserProvisioning,
} from "@/server/users/user-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("user company assignments integration", () => {
  const createdUserIds: string[] = [];
  const createdCompanyIds: string[] = [];

  it("records the user_company_assignments migration when applied", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name = '20260820240000_user_company_assignments'
    `;
    expect(rows).toHaveLength(1);
  });

  it("persists assignments and denies Staff unassigned company data (E2E-07 precursor)", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });

    const assigned = await prisma.company.create({
      data: { displayName: `Assign A ${Date.now()}`, status: "ACTIVE" },
    });
    const other = await prisma.company.create({
      data: { displayName: `Assign B ${Date.now()}`, status: "ACTIVE" },
    });
    createdCompanyIds.push(assigned.id, other.id);

    const actor = await prisma.user.create({
      data: {
        name: "Assignment Admin",
        email: `assign-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: crypto.randomUUID(),
        roleId: adminRole.id,
        status: "ACTIVE",
      },
    });
    createdUserIds.push(actor.id);

    const adminPrincipal: AuthorizationPrincipal = {
      userId: actor.id,
      status: "ACTIVE",
      roleCode: "ADMIN",
      assignedCompanyIds: [],
    };

    let nextAuthId = crypto.randomUUID();
    const authProvisioning: AuthUserProvisioning = {
      async createAuthUser() {
        const authUserId = nextAuthId;
        nextAuthId = crypto.randomUUID();
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

    const userDeps = {
      store: new PrismaUserManagementStore(),
      authProvisioning,
    };

    const created = await createManagedUser(
      adminPrincipal,
      {
        name: "Assigned Staff",
        email: `assigned-staff-${Date.now()}@example.com`,
        roleCode: "STAFF",
        companyIds: [assigned.id],
      },
      userDeps,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("create failed");
    }
    createdUserIds.push(created.data.id);
    expect(created.data.companyIds).toEqual([assigned.id]);

    const fetched = await getManagedUser(adminPrincipal, created.data.id, userDeps);
    expect(fetched.ok).toBe(true);
    if (fetched.ok) {
      expect(fetched.data.companyIds).toEqual([assigned.id]);
    }

    const rows = await prisma.userCompany.findMany({ where: { userId: created.data.id } });
    expect(rows.map((row) => row.companyId)).toEqual([assigned.id]);

    const staffPrincipal: AuthorizationPrincipal = {
      userId: created.data.id,
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [assigned.id],
    };
    const companyDeps = { store: new PrismaCompanyStore() };

    const assignedRead = await getCompany(staffPrincipal, assigned.id, companyDeps);
    expect(assignedRead.ok).toBe(true);

    const unassignedRead = await getCompany(staffPrincipal, other.id, companyDeps);
    expect(unassignedRead.ok).toBe(false);
    if (!unassignedRead.ok) {
      expect(unassignedRead.status).toBe(403);
      expect(unassignedRead.error).toBe(GENERIC_FORBIDDEN);
    }

    const listed = await listCompanies(staffPrincipal, companyDeps);
    expect(listed.ok).toBe(false);
    if (!listed.ok) {
      expect(listed.status).toBe(403);
    }

    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const tableNames = tables.map((table) => table.table_name);
    expect(tableNames).toContain("user_companies");
    expect(tableNames).toContain("companies");
  }, 30_000);

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (createdCompanyIds.length > 0) {
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
    await prisma.$disconnect();
  });
});

import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  assertTransactionalCompanyScope,
  requireConcreteCompanyId,
} from "@/domain/company-context/enforce";
import { resolveCompanyContext } from "@/domain/company-context/resolve";
import {
  ALL_COMPANIES_CONTEXT_VALUE,
  CONCRETE_COMPANY_REQUIRED_MESSAGE,
  INVALID_COMPANY_CONTEXT_MESSAGE,
} from "@/domain/company-context/types";
import { listSwitcherCompanies } from "@/server/company-context/accessible-companies";
import { PrismaCompanyStore } from "@/server/companies/company-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("company context / tenant isolation integration", () => {
  const createdCompanyIds: string[] = [];
  const createdUserIds: string[] = [];

  afterAll(async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdUserIds.length > 0) {
      await prisma.userCompany.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (createdCompanyIds.length > 0) {
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
  });

  it("lists Admin all companies and Staff assigned-only for the switcher", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const staffRole = await prisma.role.findUniqueOrThrow({ where: { code: "STAFF" } });

    const assigned = await prisma.company.create({
      data: { displayName: `Ctx A ${Date.now()}`, status: "ACTIVE" },
    });
    const other = await prisma.company.create({
      data: { displayName: `Ctx B ${Date.now()}`, status: "ACTIVE" },
    });
    createdCompanyIds.push(assigned.id, other.id);

    const staffUser = await prisma.user.create({
      data: {
        name: "Context Staff",
        email: `ctx-staff-${Date.now()}@example.com`,
        supabaseAuthUserId: crypto.randomUUID(),
        roleId: staffRole.id,
        status: "ACTIVE",
        companies: { create: [{ companyId: assigned.id }] },
      },
    });
    createdUserIds.push(staffUser.id);

    const admin: AuthorizationPrincipal = {
      userId: "admin-actor",
      status: "ACTIVE",
      roleCode: "ADMIN",
      assignedCompanyIds: [],
    };
    const staff: AuthorizationPrincipal = {
      userId: staffUser.id,
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [assigned.id],
    };

    const store = new PrismaCompanyStore();
    const adminList = await listSwitcherCompanies(admin, store);
    expect(adminList.some((company) => company.id === assigned.id)).toBe(true);
    expect(adminList.some((company) => company.id === other.id)).toBe(true);

    const staffList = await listSwitcherCompanies(staff, store);
    expect(staffList.map((company) => company.id)).toEqual([assigned.id]);
  });

  it("rejects transactional API scope without a concrete company (All Companies)", async () => {
    const admin: AuthorizationPrincipal = {
      userId: "admin-actor",
      status: "ACTIVE",
      roleCode: "ADMIN",
      assignedCompanyIds: [],
    };
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const company = await prisma.company.create({
      data: { displayName: `Ctx Tx ${Date.now()}`, status: "ACTIVE" },
    });
    createdCompanyIds.push(company.id);

    const resolved = resolveCompanyContext({
      principal: admin,
      rawSelection: ALL_COMPANIES_CONTEXT_VALUE,
      accessibleCompanyIds: [company.id],
    });

    expect(() => requireConcreteCompanyId(resolved)).toThrow(CONCRETE_COMPANY_REQUIRED_MESSAGE);
    expect(() => assertTransactionalCompanyScope(admin, resolved, company.id)).toThrow(
      CONCRETE_COMPANY_REQUIRED_MESSAGE,
    );
  });

  it("denies cross-company IDOR when requested company differs from context", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const staffRole = await prisma.role.findUniqueOrThrow({ where: { code: "STAFF" } });

    const assigned = await prisma.company.create({
      data: { displayName: `Ctx IDOR A ${Date.now()}`, status: "ACTIVE" },
    });
    const other = await prisma.company.create({
      data: { displayName: `Ctx IDOR B ${Date.now()}`, status: "ACTIVE" },
    });
    createdCompanyIds.push(assigned.id, other.id);

    const staffUser = await prisma.user.create({
      data: {
        name: "IDOR Staff",
        email: `ctx-idor-${Date.now()}@example.com`,
        supabaseAuthUserId: crypto.randomUUID(),
        roleId: staffRole.id,
        status: "ACTIVE",
        companies: { create: [{ companyId: assigned.id }] },
      },
    });
    createdUserIds.push(staffUser.id);

    const staff: AuthorizationPrincipal = {
      userId: staffUser.id,
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [assigned.id],
    };

    const resolved = resolveCompanyContext({
      principal: staff,
      rawSelection: assigned.id,
      accessibleCompanyIds: [assigned.id],
    });

    expect(() => assertTransactionalCompanyScope(staff, resolved, other.id)).toThrow(
      INVALID_COMPANY_CONTEXT_MESSAGE,
    );

    // Staff cannot use unassigned company even with a forged matching pair.
    const forged = {
      status: "resolved" as const,
      selection: { kind: "company" as const, companyId: other.id },
    };
    expect(() => assertTransactionalCompanyScope(staff, forged, other.id)).toThrow();
  });
});

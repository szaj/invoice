import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { authorizeCompanyAccess } from "@/domain/authz/company-access";
import { getCompany } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { createCompany } from "@/server/companies/company-service";
import {
  createReportingGroup,
  getReportingGroup,
  updateReportingGroup,
} from "@/server/reporting-groups/reporting-group-service";
import { PrismaReportingGroupStore } from "@/server/reporting-groups/reporting-group-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("reporting groups integration", () => {
  const createdCompanyIds: string[] = [];
  const createdGroupIds: string[] = [];

  it("records the reporting_groups migration when applied", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name = '20260820260000_reporting_groups'
    `;
    expect(rows).toHaveLength(1);
  });

  it("persists group assignment and never grants Staff access via membership", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const companyDeps = { store: new PrismaCompanyStore() };
    const groupDeps = { store: new PrismaReportingGroupStore() };
    const admin: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee3",
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    const marker = `task011-${Date.now()}`;
    const companyA = await createCompany(
      admin,
      {
        displayName: `Task 011 A ${marker}`,
        legalName: null,
        email: null,
        phone: null,
        website: null,
        registrationTaxNumber: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        region: null,
        postalCode: null,
        countryCode: "AE",
        status: "ACTIVE",
      },
      companyDeps,
    );
    const companyB = await createCompany(
      admin,
      {
        displayName: `Task 011 B ${marker}`,
        legalName: null,
        email: null,
        phone: null,
        website: null,
        registrationTaxNumber: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        region: null,
        postalCode: null,
        countryCode: "AE",
        status: "ACTIVE",
      },
      companyDeps,
    );
    expect(companyA.ok && companyB.ok).toBe(true);
    if (!companyA.ok || !companyB.ok) {
      throw new Error("company create failed");
    }
    createdCompanyIds.push(companyA.data.id, companyB.data.id);

    const created = await createReportingGroup(
      admin,
      {
        name: `Rollup ${marker}`,
        code: `T${String(Date.now()).slice(-6)}`,
        status: "ACTIVE",
        displayOrder: 1,
        companyIds: [companyA.data.id, companyB.data.id],
      },
      groupDeps,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("group create failed");
    }
    createdGroupIds.push(created.data.id);
    expect([...created.data.companyIds].sort()).toEqual(
      [companyA.data.id, companyB.data.id].sort(),
    );

    const persisted = await prisma.company.findMany({
      where: { id: { in: [companyA.data.id, companyB.data.id] } },
      select: { id: true, reportingGroupId: true },
    });
    expect(persisted.every((row) => row.reportingGroupId === created.data.id)).toBe(true);

    const staff: AuthorizationPrincipal = {
      userId: "staff-actor",
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [companyA.data.id],
    };
    expect(authorizeCompanyAccess(staff, companyA.data.id).allowed).toBe(true);
    expect(authorizeCompanyAccess(staff, companyB.data.id).allowed).toBe(false);

    const staffGetB = await getCompany(staff, companyB.data.id, companyDeps);
    expect(staffGetB.ok).toBe(false);
    if (!staffGetB.ok) {
      expect(staffGetB.status).toBe(403);
    }

    const staffMutate = await updateReportingGroup(
      staff,
      created.data.id,
      {
        name: "Nope",
        code: created.data.code,
        companyIds: [companyA.data.id],
      },
      groupDeps,
    );
    expect(staffMutate.ok).toBe(false);
    if (!staffMutate.ok) {
      expect(staffMutate.status).toBe(403);
    }

    const reassigned = await updateReportingGroup(
      admin,
      created.data.id,
      {
        name: created.data.name,
        code: created.data.code,
        status: "ACTIVE",
        displayOrder: 1,
        companyIds: [companyA.data.id],
      },
      groupDeps,
    );
    expect(reassigned.ok).toBe(true);
    if (reassigned.ok) {
      expect(reassigned.data.companyIds).toEqual([companyA.data.id]);
    }

    const companyBRow = await prisma.company.findUniqueOrThrow({
      where: { id: companyB.data.id },
    });
    expect(companyBRow.reportingGroupId).toBeNull();

    const fetched = await getReportingGroup(admin, created.data.id, groupDeps);
    expect(fetched.ok).toBe(true);

    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const tableNames = tables.map((table) => table.table_name);
    expect(tableNames).toContain("company_groups");
    expect(tableNames).not.toContain("company_currencies");
    expect(tableNames).toContain("audit_logs");
  }, 30_000);

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdCompanyIds.length > 0) {
      await prisma.company.updateMany({
        where: { id: { in: createdCompanyIds } },
        data: { reportingGroupId: null },
      });
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
    if (createdGroupIds.length > 0) {
      await prisma.companyGroup.deleteMany({ where: { id: { in: createdGroupIds } } });
    }
    await prisma.$disconnect();
  });
});

import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { AuditActions } from "@/domain/audit/types";
import { COMPANY_CURRENCY_INACTIVE_GLOBAL } from "@/domain/companies/company-currency-types";
import {
  getCompanyCurrencyConfiguration,
  updateCompanyCurrencyConfiguration,
} from "@/server/companies/company-currency-service";
import { PrismaCompanyCurrencyStore } from "@/server/companies/company-currency-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("company currency configuration integration", () => {
  const createdCompanyIds: string[] = [];
  const createdCurrencyIds: string[] = [];
  const createdAuditIds: string[] = [];

  it("records the company_currency_configuration migration when applied", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name = '20260820300000_company_currency_configuration'
    `;
    expect(rows).toHaveLength(1);
  });

  it("persists an enabled subset and rejects inactive global currencies", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const deps = { store: new PrismaCompanyCurrencyStore() };

    const admin: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee21",
      status: "ACTIVE",
      roleCode: "ADMIN",
    };
    const staff: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee22",
      status: "ACTIVE",
      roleCode: "STAFF",
    };

    const company = await prisma.company.create({
      data: {
        displayName: `Currency Config ${Date.now()}`,
        status: "ACTIVE",
      },
    });
    createdCompanyIds.push(company.id);

    const usd = await prisma.currency.findUniqueOrThrow({ where: { code: "USD" } });
    const aed = await prisma.currency.findUniqueOrThrow({ where: { code: "AED" } });

    const inactiveCode = `T${Date.now().toString(36).slice(-2).toUpperCase()}`.slice(0, 3);
    const inactive = await prisma.currency.create({
      data: {
        code: inactiveCode.length === 3 ? inactiveCode : "TZZ",
        name: "Inactive Temp",
        symbol: "Z",
        decimalPrecision: 2,
        status: "INACTIVE",
      },
    });
    createdCurrencyIds.push(inactive.id);

    const read = await getCompanyCurrencyConfiguration(admin, company.id, deps);
    expect(read.ok).toBe(true);

    const staffDenied = await updateCompanyCurrencyConfiguration(
      staff,
      company.id,
      { enabledCurrencyIds: [usd.id], defaultCurrencyId: usd.id },
      deps,
    );
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
      expect(staffDenied.error).toBe(GENERIC_FORBIDDEN);
    }

    const inactiveDenied = await updateCompanyCurrencyConfiguration(
      admin,
      company.id,
      { enabledCurrencyIds: [inactive.id], defaultCurrencyId: inactive.id },
      deps,
    );
    expect(inactiveDenied.ok).toBe(false);
    if (!inactiveDenied.ok) {
      expect(inactiveDenied.status).toBe(400);
      expect(inactiveDenied.error).toBe(COMPANY_CURRENCY_INACTIVE_GLOBAL);
    }

    const updated = await updateCompanyCurrencyConfiguration(
      admin,
      company.id,
      { enabledCurrencyIds: [usd.id, aed.id], defaultCurrencyId: aed.id },
      deps,
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      throw new Error("update failed");
    }
    expect([...updated.data.enabledCurrencyIds].sort()).toEqual([usd.id, aed.id].sort());
    expect(updated.data.defaultCurrencyId).toBe(aed.id);

    const rows = await prisma.companyCurrency.findMany({ where: { companyId: company.id } });
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.isDefault)).toHaveLength(1);

    const events = await prisma.auditLog.findMany({
      where: {
        action: AuditActions.COMPANY_CURRENCIES_UPDATED,
        entityId: company.id,
      },
      orderBy: { occurredAt: "desc" },
      take: 1,
    });
    expect(events).toHaveLength(1);
    createdAuditIds.push(events[0]!.id);

    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const tableNames = tables.map((table) => table.table_name);
    expect(tableNames).toContain("company_currencies");
  }, 30_000);

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdAuditIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { id: { in: createdAuditIds } } });
    }
    if (createdCompanyIds.length > 0) {
      await prisma.companyCurrency.deleteMany({
        where: { companyId: { in: createdCompanyIds } },
      });
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
    if (createdCurrencyIds.length > 0) {
      await prisma.currency.deleteMany({ where: { id: { in: createdCurrencyIds } } });
    }
    await prisma.$disconnect();
  });
});

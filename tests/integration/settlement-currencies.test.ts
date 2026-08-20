import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { AuditActions } from "@/domain/audit/types";
import {
  SETTLEMENT_CURRENCY_INACTIVE_GLOBAL,
  SETTLEMENT_CURRENCY_NOT_ENABLED,
} from "@/domain/settlement/types";
import {
  getCompanySettlementConfiguration,
  updatePaymentMethodSettlementConfiguration,
  validateSettlementCurrencyForMethod,
} from "@/server/settlement/settlement-service";
import { PrismaSettlementConfigStore } from "@/server/settlement/settlement-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("settlement currency configuration integration", () => {
  const createdCompanyIds: string[] = [];
  const createdCurrencyIds: string[] = [];
  const createdAuditIds: string[] = [];

  it("records the settlement_currency_configuration migration when applied", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name = '20260820320000_settlement_currency_configuration'
    `;
    expect(rows).toHaveLength(1);
  });

  it("persists settlement enablement and rejects non-enabled currencies", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const deps = { store: new PrismaSettlementConfigStore() };

    const admin: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee31",
      status: "ACTIVE",
      roleCode: "ADMIN",
    };
    const staff: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee32",
      status: "ACTIVE",
      roleCode: "STAFF",
    };

    const company = await prisma.company.create({
      data: {
        displayName: `Settlement Config ${Date.now()}`,
        status: "ACTIVE",
      },
    });
    createdCompanyIds.push(company.id);

    // Letter-only ISO-style code so Zod accepts it before ACTIVE-catalog rejection.
    const inactiveCode = `Z${String.fromCharCode(65 + (Date.now() % 26))}${"ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Date.now() % 26]}`;
    const inactive = await prisma.currency.create({
      data: {
        code: inactiveCode,
        name: "Inactive Settlement Temp",
        symbol: "Z",
        decimalPrecision: 2,
        status: "INACTIVE",
      },
    });
    createdCurrencyIds.push(inactive.id);

    const read = await getCompanySettlementConfiguration(admin, company.id, deps);
    expect(read.ok).toBe(true);

    const staffDenied = await updatePaymentMethodSettlementConfiguration(
      staff,
      company.id,
      "STRIPE",
      { methodEnabled: true, enabledSettlementCurrencyCodes: ["USD"] },
      deps,
    );
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
      expect(staffDenied.error).toBe(GENERIC_FORBIDDEN);
    }

    const inactiveDenied = await updatePaymentMethodSettlementConfiguration(
      admin,
      company.id,
      "STRIPE",
      { methodEnabled: true, enabledSettlementCurrencyCodes: [inactive.code] },
      deps,
    );
    expect(inactiveDenied.ok).toBe(false);
    if (!inactiveDenied.ok) {
      expect(inactiveDenied.status).toBe(400);
      expect(inactiveDenied.error).toBe(SETTLEMENT_CURRENCY_INACTIVE_GLOBAL);
    }

    const updated = await updatePaymentMethodSettlementConfiguration(
      admin,
      company.id,
      "STRIPE",
      { methodEnabled: true, enabledSettlementCurrencyCodes: ["USD", "AED"] },
      deps,
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      throw new Error("update failed");
    }
    const stripe = updated.data.methods.find((method) => method.methodCode === "STRIPE");
    expect(stripe?.methodEnabled).toBe(true);
    expect([...stripe!.enabledSettlementCurrencyCodes].sort()).toEqual(["AED", "USD"]);

    const rows = await prisma.paymentGatewaySettlementCurrency.findMany({
      where: { gatewayConfig: { companyId: company.id, methodCode: "STRIPE" } },
    });
    expect(rows).toHaveLength(2);

    const notEnabled = await validateSettlementCurrencyForMethod(
      admin,
      company.id,
      "STRIPE",
      "GBP",
      deps,
    );
    expect(notEnabled.ok).toBe(false);
    if (!notEnabled.ok) {
      expect(notEnabled.status).toBe(400);
      expect(notEnabled.error).toBe(SETTLEMENT_CURRENCY_NOT_ENABLED);
    }

    const enabledOk = await validateSettlementCurrencyForMethod(
      admin,
      company.id,
      "STRIPE",
      "USD",
      deps,
    );
    expect(enabledOk.ok).toBe(true);

    const events = await prisma.auditLog.findMany({
      where: {
        action: AuditActions.SETTLEMENT_CURRENCIES_UPDATED,
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
    expect(tableNames).toContain("payment_gateway_configs");
    expect(tableNames).toContain("payment_gateway_settlement_currencies");
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
      await prisma.paymentGatewayConfig.deleteMany({
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

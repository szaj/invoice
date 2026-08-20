import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { AuditActions } from "@/domain/audit/types";
import { DEFAULT_CURRENCY_CODES } from "@/domain/currencies/types";
import {
  createCurrency,
  listCurrencies,
  setCurrencyStatus,
  updateCurrency,
} from "@/server/currencies/currency-service";
import { PrismaCurrencyStore } from "@/server/currencies/currency-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("currency master integration", () => {
  const createdCurrencyIds: string[] = [];
  const createdAuditIds: string[] = [];

  it("records the currency_master migration when applied", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name = '20260820290000_currency_master'
    `;
    expect(rows).toHaveLength(1);
  });

  it("seeds the five default currencies and supports Admin CRUD", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const deps = { store: new PrismaCurrencyStore() };

    const admin: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee11",
      status: "ACTIVE",
      roleCode: "ADMIN",
    };
    const staff: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee12",
      status: "ACTIVE",
      roleCode: "STAFF",
    };

    const listed = await listCurrencies(admin, deps);
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      throw new Error("list failed");
    }
    const codes = listed.data.map((currency) => currency.code);
    for (const code of DEFAULT_CURRENCY_CODES) {
      expect(codes).toContain(code);
    }

    const marker = `T${String.fromCharCode(65 + (Date.now() % 26))}${String.fromCharCode(65 + (((Date.now() / 26) % 26) | 0))}`;
    const denied = await createCurrency(
      staff,
      {
        code: marker,
        name: "Temp Currency",
        symbol: "T",
        decimalPrecision: 2,
      },
      deps,
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(403);
      expect(denied.error).toBe(GENERIC_FORBIDDEN);
    }

    const created = await createCurrency(
      admin,
      {
        code: marker,
        name: "Temp Currency",
        symbol: "T",
        decimalPrecision: 2,
      },
      deps,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("create failed");
    }
    createdCurrencyIds.push(created.data.id);

    const updated = await updateCurrency(
      admin,
      created.data.id,
      {
        name: "Temp Currency Updated",
        symbol: "TU",
        decimalPrecision: 3,
        status: "ACTIVE",
      },
      deps,
    );
    expect(updated.ok).toBe(true);

    const disabled = await setCurrencyStatus(admin, created.data.id, { status: "INACTIVE" }, deps);
    expect(disabled.ok).toBe(true);
    if (disabled.ok) {
      expect(disabled.data.status).toBe("INACTIVE");
    }

    const events = await prisma.auditLog.findMany({
      where: {
        entityId: created.data.id,
        action: {
          in: [
            AuditActions.CURRENCY_CREATED,
            AuditActions.CURRENCY_UPDATED,
            AuditActions.CURRENCY_STATUS_CHANGED,
          ],
        },
      },
    });
    expect(events.length).toBeGreaterThanOrEqual(3);
    createdAuditIds.push(...events.map((event) => event.id));

    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const tableNames = tables.map((table) => table.table_name);
    expect(tableNames).toContain("currencies");
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
    if (createdCurrencyIds.length > 0) {
      await prisma.currency.deleteMany({ where: { id: { in: createdCurrencyIds } } });
    }
    await prisma.$disconnect();
  });
});

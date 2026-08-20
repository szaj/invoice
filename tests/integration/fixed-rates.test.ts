import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { AuditActions } from "@/domain/audit/types";
import {
  createFixedConversionRate,
  listFixedConversionRates,
} from "@/server/fixed-rates/fixed-rate-service";
import { PrismaFixedConversionRateStore } from "@/server/fixed-rates/fixed-rate-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("fixed conversion rate versioning integration", () => {
  const createdRateIds: string[] = [];
  const createdAuditIds: string[] = [];

  it("records the fixed_conversion_rate_schema migration when applied", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name = '20260820310000_fixed_conversion_rate_schema'
    `;
    expect(rows).toHaveLength(1);
  });

  it("creates versions, expires previous, retains history, and denies Non-Admin", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const deps = { store: new PrismaFixedConversionRateStore() };

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

    const staffDenied = await createFixedConversionRate(
      staff,
      {
        fromCurrency: "USD",
        toCurrency: "AED",
        fixedRate: "3.670000000001",
        frequencyLabel: "YEARLY",
        validFrom: "2026-01-01T00:00:00.000Z",
      },
      deps,
    );
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
      expect(staffDenied.error).toBe(GENERIC_FORBIDDEN);
    }

    const suffix = Date.now().toString(36).slice(-4).toUpperCase();
    const fromCurrency = "AUD";
    const toCurrency = "AED";

    const v1 = await createFixedConversionRate(
      admin,
      {
        fromCurrency,
        toCurrency,
        fixedRate: "2.450000000001",
        frequencyLabel: "YEARLY",
        validFrom: "2026-01-01T00:00:00.000Z",
        notes: `TASK-017 v1 ${suffix}`,
      },
      deps,
    );
    expect(v1.ok).toBe(true);
    if (!v1.ok) {
      throw new Error("v1 failed");
    }
    createdRateIds.push(v1.data.id);

    const v2 = await createFixedConversionRate(
      admin,
      {
        fromCurrency,
        toCurrency,
        fixedRate: "2.460000000002",
        frequencyLabel: "MONTHLY",
        validFrom: "2026-07-01T00:00:00.000Z",
        notes: `TASK-017 v2 ${suffix}`,
      },
      deps,
    );
    expect(v2.ok).toBe(true);
    if (!v2.ok) {
      throw new Error("v2 failed");
    }
    createdRateIds.push(v2.data.id);
    expect(v2.data.versionNo).toBe(v1.data.versionNo + 1);

    const history = await listFixedConversionRates(admin, { fromCurrency, toCurrency }, deps);
    expect(history.ok).toBe(true);
    if (!history.ok) {
      throw new Error("history failed");
    }

    const ours = history.data.filter((rate) => createdRateIds.includes(rate.id));
    expect(ours).toHaveLength(2);
    const active = ours.find((rate) => rate.id === v2.data.id);
    const expired = ours.find((rate) => rate.id === v1.data.id);
    expect(active?.status).toBe("ACTIVE");
    expect(expired?.status).toBe("EXPIRED");
    expect(expired?.fixedRate).toBe("2.450000000001");
    expect(expired?.validTo?.toISOString()).toBe("2026-07-01T00:00:00.000Z");

    const events = await prisma.auditLog.findMany({
      where: {
        entityId: { in: createdRateIds },
        action: {
          in: [
            AuditActions.FIXED_RATE_CREATED,
            AuditActions.FIXED_RATE_ACTIVATED,
            AuditActions.FIXED_RATE_EXPIRED,
            AuditActions.FIXED_RATE_SUPERSEDED,
          ],
        },
      },
    });
    expect(events.length).toBeGreaterThanOrEqual(4);
    createdAuditIds.push(...events.map((event) => event.id));
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
    if (createdRateIds.length > 0) {
      await prisma.fixedConversionRate.deleteMany({ where: { id: { in: createdRateIds } } });
    }
    await prisma.$disconnect();
  });
});

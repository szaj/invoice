import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { AuditActions } from "@/domain/audit/types";
import { getSystemSettings, updateSystemSettings } from "@/server/settings/settings-service";
import { PrismaSystemSettingsStore } from "@/server/settings/settings-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("core system settings integration", () => {
  const createdAuditIds: string[] = [];
  let previous:
    | {
        reportingCurrencyCode: string;
        defaultTimezone: string;
        roundingTolerance: string;
      }
    | undefined;

  it("records the core_system_settings migration when applied", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name = '20260820280000_core_system_settings'
    `;
    expect(rows).toHaveLength(1);
  });

  it("supports Admin read/update and denies Non-Admin mutation", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const deps = { store: new PrismaSystemSettingsStore() };

    const admin: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee01",
      status: "ACTIVE",
      roleCode: "ADMIN",
    };
    const staff: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee02",
      status: "ACTIVE",
      roleCode: "STAFF",
    };

    const current = await getSystemSettings(admin, deps);
    expect(current.ok).toBe(true);
    if (!current.ok) {
      throw new Error("read failed");
    }
    previous = {
      reportingCurrencyCode: current.data.reportingCurrencyCode,
      defaultTimezone: current.data.defaultTimezone,
      roundingTolerance: current.data.roundingTolerance,
    };

    const denied = await updateSystemSettings(
      staff,
      {
        reportingCurrencyCode: "GBP",
        defaultTimezone: "Europe/London",
        roundingTolerance: "0.02",
      },
      deps,
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(403);
      expect(denied.error).toBe(GENERIC_FORBIDDEN);
    }

    const nextCurrency = previous.reportingCurrencyCode === "USD" ? "AED" : "USD";
    const updated = await updateSystemSettings(
      admin,
      {
        reportingCurrencyCode: nextCurrency,
        defaultTimezone: "Asia/Dubai",
        roundingTolerance: "0.01",
      },
      deps,
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      throw new Error("update failed");
    }
    expect(updated.data.reportingCurrencyCode).toBe(nextCurrency);
    expect(updated.data.defaultTimezone).toBe("Asia/Dubai");

    const events = await prisma.auditLog.findMany({
      where: {
        action: AuditActions.SETTINGS_UPDATED,
        entityId: updated.data.id,
      },
      orderBy: { occurredAt: "desc" },
      take: 1,
    });
    expect(events).toHaveLength(1);
    createdAuditIds.push(events[0]!.id);

    const permission = await prisma.permission.findUnique({
      where: { code: "settings.manage" },
    });
    expect(permission).not.toBeNull();

    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const tableNames = tables.map((table) => table.table_name);
    expect(tableNames).toContain("system_settings");
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
    if (previous) {
      await prisma.systemSettings.updateMany({
        data: {
          reportingCurrencyCode: previous.reportingCurrencyCode,
          defaultTimezone: previous.defaultTimezone,
          roundingTolerance: previous.roundingTolerance,
        },
      });
    }
    await prisma.$disconnect();
  });
});

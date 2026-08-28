import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { AuditActions } from "@/domain/audit/types";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "@/server/settings/notification-settings-service";
import { PrismaSystemSettingsStore } from "@/server/settings/settings-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("notification settings integration (TASK-092)", () => {
  const createdAuditIds: string[] = [];
  let previous:
    | {
        notifyInvoiceEmailSent: boolean;
        notifyInvoiceEmailFailed: boolean;
        notifyPaymentSuccess: boolean;
        notifyPaymentFailed: boolean;
        notifyInvoiceOverdue: boolean;
        notifyInvoiceOverdueToAdmin: boolean;
        notifyInvoiceOverdueToAssignedStaff: boolean;
        notifyComplianceFlagged: boolean;
        notifyGatewayFailure: boolean;
      }
    | undefined;

  it("persists notification toggles for Admin and denies Non-Admin mutation", async () => {
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

    const current = await getNotificationSettings(admin, deps);
    expect(current.ok).toBe(true);
    if (!current.ok) {
      throw new Error("read failed");
    }
    previous = { ...current.data };

    const denied = await updateNotificationSettings(
      staff,
      {
        ...current.data,
        notifyPaymentSuccess: !current.data.notifyPaymentSuccess,
      },
      deps,
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(403);
      expect(denied.error).toBe(GENERIC_FORBIDDEN);
    }

    const updated = await updateNotificationSettings(
      admin,
      {
        notifyInvoiceEmailSent: false,
        notifyInvoiceEmailFailed: true,
        notifyPaymentSuccess: true,
        notifyPaymentFailed: false,
        notifyInvoiceOverdue: true,
        notifyInvoiceOverdueToAdmin: false,
        notifyInvoiceOverdueToAssignedStaff: true,
        notifyComplianceFlagged: true,
        notifyGatewayFailure: false,
      },
      deps,
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      throw new Error("update failed");
    }
    expect(updated.data.notifyInvoiceEmailSent).toBe(false);
    expect(updated.data.notifyPaymentSuccess).toBe(true);
    expect(updated.data.notifyInvoiceOverdueToAdmin).toBe(false);
    expect(updated.data.notifyGatewayFailure).toBe(false);

    const row = await prisma.systemSettings.findFirst({ orderBy: { createdAt: "asc" } });
    expect(row?.notifyInvoiceEmailSent).toBe(false);
    expect(row?.notifyPaymentSuccess).toBe(true);
    expect(row?.notifyInvoiceOverdueToAdmin).toBe(false);
    expect(row?.notifyGatewayFailure).toBe(false);

    const events = await prisma.auditLog.findMany({
      where: {
        action: AuditActions.SETTINGS_UPDATED,
      },
      orderBy: { occurredAt: "desc" },
      take: 1,
    });
    expect(events).toHaveLength(1);
    createdAuditIds.push(events[0]!.id);
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
        data: previous,
      });
    }
    await prisma.$disconnect();
  });
});

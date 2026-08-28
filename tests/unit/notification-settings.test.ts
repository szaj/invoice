import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import type { RoleCode } from "@/domain/authz/roles";
import { notificationSettingsUpdateSchema } from "@/domain/notifications/schema";
import type { NotificationSettingsFlags } from "@/domain/notifications/types";
import type { SystemSettingsRecord } from "@/domain/settings/types";
import {
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSettingsDependencies,
} from "@/server/settings/notification-settings-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";
import { testSystemSettingsRecord } from "../helpers/system-settings-record";

function principal(roleCode: RoleCode | null): AuthorizationPrincipal {
  return {
    userId: "actor-1",
    status: "ACTIVE",
    roleCode,
  };
}

function notificationFlags(
  overrides: Partial<NotificationSettingsFlags> = {},
): NotificationSettingsFlags {
  return {
    notifyInvoiceEmailSent: true,
    notifyInvoiceEmailFailed: true,
    notifyPaymentSuccess: false,
    notifyPaymentFailed: false,
    notifyInvoiceOverdue: true,
    notifyInvoiceOverdueToAdmin: true,
    notifyInvoiceOverdueToAssignedStaff: true,
    notifyComplianceFlagged: true,
    notifyGatewayFailure: true,
    ...overrides,
  };
}

function createDeps(
  initial: SystemSettingsRecord = testSystemSettingsRecord(),
): NotificationSettingsDependencies & {
  store: { current: SystemSettingsRecord };
} {
  const store = {
    current: initial,
    async getSettings() {
      return store.current;
    },
    async updateSettings(input: {
      reportingCurrencyCode: string;
      defaultTimezone: string;
      roundingTolerance: string;
      invoiceNumberIncludeYear: boolean;
    }) {
      store.current = {
        ...store.current,
        ...input,
        updatedAt: new Date("2026-08-20T12:00:00.000Z"),
      };
      return store.current;
    },
    async updateNotificationSettings(input: NotificationSettingsFlags) {
      store.current = {
        ...store.current,
        ...input,
        updatedAt: new Date("2026-08-28T12:00:00.000Z"),
      };
      return store.current;
    },
  };

  return {
    store,
    auditWriter: createMemoryAuditWriter(),
  };
}

describe("notification settings schema", () => {
  it("accepts boolean toggle payloads", () => {
    expect(notificationSettingsUpdateSchema.safeParse(notificationFlags()).success).toBe(true);
  });

  it("rejects missing or invalid fields", () => {
    expect(
      notificationSettingsUpdateSchema.safeParse({
        notifyInvoiceEmailSent: true,
      }).success,
    ).toBe(false);
    expect(
      notificationSettingsUpdateSchema.safeParse({
        ...notificationFlags(),
        notifyPaymentSuccess: "yes",
      }).success,
    ).toBe(false);
  });
});

describe("notification settings authorization", () => {
  it("allows Admin read/update and denies Compliance and Staff", async () => {
    const deps = createDeps();

    const adminRead = await getNotificationSettings(principal("ADMIN"), deps);
    expect(adminRead.ok).toBe(true);

    const staffRead = await getNotificationSettings(principal("STAFF"), deps);
    expect(staffRead.ok).toBe(false);
    if (!staffRead.ok) {
      expect(staffRead.status).toBe(403);
      expect(staffRead.error).toBe(GENERIC_FORBIDDEN);
    }

    const complianceUpdate = await updateNotificationSettings(
      principal("COMPLIANCE"),
      notificationFlags({ notifyPaymentSuccess: true }),
      deps,
    );
    expect(complianceUpdate.ok).toBe(false);
    if (!complianceUpdate.ok) {
      expect(complianceUpdate.status).toBe(403);
    }
  });

  it("updates toggles and writes an audit event for Admin", async () => {
    const auditWriter = createMemoryAuditWriter();
    const deps = { ...createDeps(), auditWriter };

    const updated = await updateNotificationSettings(
      principal("ADMIN"),
      notificationFlags({
        notifyPaymentSuccess: true,
        notifyPaymentFailed: true,
        notifyInvoiceOverdue: false,
      }),
      deps,
    );

    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      throw new Error("update failed");
    }
    expect(updated.data.notifyPaymentSuccess).toBe(true);
    expect(updated.data.notifyPaymentFailed).toBe(true);
    expect(updated.data.notifyInvoiceOverdue).toBe(false);
    expect(auditWriter.events).toHaveLength(1);
    expect(auditWriter.events[0]?.action).toBe("settings.updated");
    expect(auditWriter.events[0]?.newValues).toMatchObject({
      notifyPaymentSuccess: true,
      notifyInvoiceOverdue: false,
    });
  });
});

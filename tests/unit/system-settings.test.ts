import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import type { RoleCode } from "@/domain/authz/roles";
import { systemSettingsUpdateSchema } from "@/domain/settings/schema";
import type { SystemSettingsRecord } from "@/domain/settings/types";
import {
  getSystemSettings,
  updateSystemSettings,
  type SystemSettingsDependencies,
} from "@/server/settings/settings-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

function principal(roleCode: RoleCode | null): AuthorizationPrincipal {
  return {
    userId: "actor-1",
    status: "ACTIVE",
    roleCode,
  };
}

function settingsRecord(overrides: Partial<SystemSettingsRecord> = {}): SystemSettingsRecord {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-000000000001",
    reportingCurrencyCode: "USD",
    defaultTimezone: "UTC",
    roundingTolerance: "0",
    invoiceNumberIncludeYear: false,
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    ...overrides,
  };
}

function createDeps(
  initial: SystemSettingsRecord = settingsRecord(),
): SystemSettingsDependencies & {
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
  };

  return {
    store,
    auditWriter: createMemoryAuditWriter(),
  };
}

describe("system settings schema", () => {
  it("accepts configurable currency codes and IANA timezones", () => {
    expect(
      systemSettingsUpdateSchema.safeParse({
        reportingCurrencyCode: "aed",
        defaultTimezone: "Asia/Dubai",
        roundingTolerance: "0.01",
        invoiceNumberIncludeYear: false,
      }).success,
    ).toBe(true);
  });

  it("rejects invalid currency, timezone, and negative tolerance", () => {
    expect(
      systemSettingsUpdateSchema.safeParse({
        reportingCurrencyCode: "US",
        defaultTimezone: "UTC",
        roundingTolerance: "0",
        invoiceNumberIncludeYear: false,
      }).success,
    ).toBe(false);
    expect(
      systemSettingsUpdateSchema.safeParse({
        reportingCurrencyCode: "USD",
        defaultTimezone: "Not/AZone",
        roundingTolerance: "0",
        invoiceNumberIncludeYear: false,
      }).success,
    ).toBe(false);
    expect(
      systemSettingsUpdateSchema.safeParse({
        reportingCurrencyCode: "USD",
        defaultTimezone: "UTC",
        roundingTolerance: "-0.1",
        invoiceNumberIncludeYear: false,
      }).success,
    ).toBe(false);
  });
});

describe("system settings authorization", () => {
  it("allows Admin read/update and denies Compliance and Staff", async () => {
    const deps = createDeps();

    const adminRead = await getSystemSettings(principal("ADMIN"), deps);
    expect(adminRead.ok).toBe(true);

    const staffRead = await getSystemSettings(principal("STAFF"), deps);
    expect(staffRead.ok).toBe(false);
    if (!staffRead.ok) {
      expect(staffRead.status).toBe(403);
      expect(staffRead.error).toBe(GENERIC_FORBIDDEN);
    }

    const complianceUpdate = await updateSystemSettings(
      principal("COMPLIANCE"),
      {
        reportingCurrencyCode: "AED",
        defaultTimezone: "Asia/Dubai",
        roundingTolerance: "0.00",
        invoiceNumberIncludeYear: false,
      },
      deps,
    );
    expect(complianceUpdate.ok).toBe(false);
    if (!complianceUpdate.ok) {
      expect(complianceUpdate.status).toBe(403);
    }
  });

  it("updates settings and writes an audit event for Admin", async () => {
    const auditWriter = createMemoryAuditWriter();
    const deps = { ...createDeps(), auditWriter };

    const updated = await updateSystemSettings(
      principal("ADMIN"),
      {
        reportingCurrencyCode: "AED",
        defaultTimezone: "Asia/Dubai",
        roundingTolerance: "0.01",
        invoiceNumberIncludeYear: true,
      },
      deps,
    );

    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      throw new Error("update failed");
    }
    expect(updated.data.reportingCurrencyCode).toBe("AED");
    expect(updated.data.defaultTimezone).toBe("Asia/Dubai");
    expect(updated.data.roundingTolerance).toBe("0.01");
    expect(updated.data.invoiceNumberIncludeYear).toBe(true);
    expect(auditWriter.events).toHaveLength(1);
    expect(auditWriter.events[0]?.action).toBe("settings.updated");
  });
});

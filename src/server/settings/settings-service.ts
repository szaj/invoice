import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { systemSettingsUpdateSchema } from "@/domain/settings/schema";
import {
  SYSTEM_SETTINGS_INVALID_INPUT,
  SYSTEM_SETTINGS_NOT_FOUND,
  SYSTEM_SETTINGS_UNAVAILABLE,
  type SystemSettingsRecord,
} from "@/domain/settings/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { PrismaSystemSettingsStore } from "@/server/settings/settings-repository";

export type SystemSettingsResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 503; error: string };

export interface SystemSettingsDependencies {
  readonly store: Pick<PrismaSystemSettingsStore, "getSettings" | "updateSettings">;
  readonly auditWriter?: AuditWriter;
}

export function createDefaultSystemSettingsDependencies(): SystemSettingsDependencies {
  return {
    store: new PrismaSystemSettingsStore(),
  };
}

function auditWriterOf(deps: SystemSettingsDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function requireSettingsManage(actor: AuthorizationPrincipal | null) {
  assertPermission(actor, "settings.manage");
}

function settingsAuditSnapshot(settings: SystemSettingsRecord) {
  return {
    reportingCurrencyCode: settings.reportingCurrencyCode,
    defaultTimezone: settings.defaultTimezone,
    roundingTolerance: settings.roundingTolerance,
    invoiceNumberIncludeYear: settings.invoiceNumberIncludeYear,
  };
}

export async function getSystemSettings(
  actor: AuthorizationPrincipal | null,
  deps: SystemSettingsDependencies = createDefaultSystemSettingsDependencies(),
): Promise<SystemSettingsResult<SystemSettingsRecord>> {
  try {
    requireSettingsManage(actor);
    const settings = await deps.store.getSettings();
    if (!settings) {
      return { ok: false, status: 404, error: SYSTEM_SETTINGS_NOT_FOUND };
    }
    return { ok: true, data: settings };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function updateSystemSettings(
  actor: AuthorizationPrincipal | null,
  input: unknown,
  deps: SystemSettingsDependencies = createDefaultSystemSettingsDependencies(),
): Promise<SystemSettingsResult<SystemSettingsRecord>> {
  try {
    requireSettingsManage(actor);
    const parsed = systemSettingsUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: SYSTEM_SETTINGS_INVALID_INPUT };
    }

    const existing = await deps.store.getSettings();
    if (!existing) {
      return { ok: false, status: 404, error: SYSTEM_SETTINGS_NOT_FOUND };
    }

    const updated = await deps.store.updateSettings(parsed.data);
    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor?.userId ?? null,
        entityType: AuditEntityTypes.SETTINGS,
        entityId: updated.id,
        action: AuditActions.SETTINGS_UPDATED,
        oldValues: settingsAuditSnapshot(existing),
        newValues: settingsAuditSnapshot(updated),
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "settings.updated",
        actorUserId: actor?.userId,
        settingsId: updated.id,
        reportingCurrencyCode: updated.reportingCurrencyCode,
        defaultTimezone: updated.defaultTimezone,
      },
      "System settings updated",
    );

    return { ok: true, data: updated };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

function toAuthzOrUnavailable(error: unknown): { ok: false; status: 403 | 503; error: string } {
  if (error && typeof error === "object" && "status" in error && "message" in error) {
    const status = error.status;
    if (status === 401 || status === 403) {
      return {
        ok: false,
        status: 403,
        error:
          typeof error.message === "string"
            ? error.message
            : "You do not have permission to perform this action.",
      };
    }
  }

  logger.error(
    { event: "settings.unavailable", err: error instanceof Error ? error.message : "unknown" },
    "System settings failed",
  );
  return { ok: false, status: 503, error: SYSTEM_SETTINGS_UNAVAILABLE };
}

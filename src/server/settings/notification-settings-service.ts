import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { notificationSettingsUpdateSchema } from "@/domain/notifications/schema";
import type { NotificationSettingsFlags } from "@/domain/notifications/types";
import {
  SYSTEM_SETTINGS_INVALID_INPUT,
  SYSTEM_SETTINGS_NOT_FOUND,
  SYSTEM_SETTINGS_UNAVAILABLE,
} from "@/domain/settings/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { PrismaSystemSettingsStore } from "@/server/settings/settings-repository";

export type NotificationSettingsResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 503; error: string };

export interface NotificationSettingsDependencies {
  readonly store: Pick<PrismaSystemSettingsStore, "getSettings" | "updateNotificationSettings">;
  readonly auditWriter?: AuditWriter;
}

export function createDefaultNotificationSettingsDependencies(): NotificationSettingsDependencies {
  return {
    store: new PrismaSystemSettingsStore(),
  };
}

function auditWriterOf(deps: NotificationSettingsDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function requireSettingsManage(actor: AuthorizationPrincipal | null) {
  assertPermission(actor, "settings.manage");
}

function notificationFlagsOf(settings: {
  notifyInvoiceEmailSent: boolean;
  notifyInvoiceEmailFailed: boolean;
  notifyPaymentSuccess: boolean;
  notifyPaymentFailed: boolean;
  notifyInvoiceOverdue: boolean;
  notifyInvoiceOverdueToAdmin: boolean;
  notifyInvoiceOverdueToAssignedStaff: boolean;
  notifyComplianceFlagged: boolean;
  notifyGatewayFailure: boolean;
}): NotificationSettingsFlags {
  return {
    notifyInvoiceEmailSent: settings.notifyInvoiceEmailSent,
    notifyInvoiceEmailFailed: settings.notifyInvoiceEmailFailed,
    notifyPaymentSuccess: settings.notifyPaymentSuccess,
    notifyPaymentFailed: settings.notifyPaymentFailed,
    notifyInvoiceOverdue: settings.notifyInvoiceOverdue,
    notifyInvoiceOverdueToAdmin: settings.notifyInvoiceOverdueToAdmin,
    notifyInvoiceOverdueToAssignedStaff: settings.notifyInvoiceOverdueToAssignedStaff,
    notifyComplianceFlagged: settings.notifyComplianceFlagged,
    notifyGatewayFailure: settings.notifyGatewayFailure,
  };
}

function notificationAuditSnapshot(settings: NotificationSettingsFlags) {
  return { ...settings };
}

export async function getNotificationSettings(
  actor: AuthorizationPrincipal | null,
  deps: NotificationSettingsDependencies = createDefaultNotificationSettingsDependencies(),
): Promise<NotificationSettingsResult<NotificationSettingsFlags>> {
  try {
    requireSettingsManage(actor);
    const settings = await deps.store.getSettings();
    if (!settings) {
      return { ok: false, status: 404, error: SYSTEM_SETTINGS_NOT_FOUND };
    }
    return { ok: true, data: notificationFlagsOf(settings) };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function updateNotificationSettings(
  actor: AuthorizationPrincipal | null,
  input: unknown,
  deps: NotificationSettingsDependencies = createDefaultNotificationSettingsDependencies(),
): Promise<NotificationSettingsResult<NotificationSettingsFlags>> {
  try {
    requireSettingsManage(actor);
    const parsed = notificationSettingsUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: SYSTEM_SETTINGS_INVALID_INPUT };
    }

    const existing = await deps.store.getSettings();
    if (!existing) {
      return { ok: false, status: 404, error: SYSTEM_SETTINGS_NOT_FOUND };
    }

    const previous = notificationFlagsOf(existing);
    const updated = await deps.store.updateNotificationSettings(parsed.data);
    const next = notificationFlagsOf(updated);

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor?.userId ?? null,
        entityType: AuditEntityTypes.SETTINGS,
        entityId: updated.id,
        action: AuditActions.SETTINGS_UPDATED,
        oldValues: notificationAuditSnapshot(previous),
        newValues: notificationAuditSnapshot(next),
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "notification_settings.updated",
        actorUserId: actor?.userId,
        settingsId: updated.id,
      },
      "Notification settings updated",
    );

    return { ok: true, data: next };
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
    {
      event: "notification_settings.unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Notification settings failed",
  );
  return { ok: false, status: 503, error: SYSTEM_SETTINGS_UNAVAILABLE };
}

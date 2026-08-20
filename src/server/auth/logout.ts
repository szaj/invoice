import "server-only";

import { logger } from "@/lib/logger";
import { GENERIC_LOGOUT_FAILURE } from "@/domain/auth/errors";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { PrismaUserIdentityStore, type UserIdentityStore } from "@/server/auth/identity-repository";
import { getAuthenticatedIdentity } from "@/server/auth/session";
import {
  getAuditWriter,
  recordAuditEventBestEffort,
  type AuditWriter,
} from "@/server/audit/audit-service";

export type LogoutResult = { ok: true } | { ok: false; error: string };

export interface LogoutDependencies {
  readonly identityStore?: UserIdentityStore;
  readonly auditWriter?: AuditWriter;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
}

export async function logoutCurrentSession(deps: LogoutDependencies = {}): Promise<LogoutResult> {
  const identityStore = deps.identityStore ?? new PrismaUserIdentityStore();
  const auditWriter = deps.auditWriter ?? getAuditWriter();

  try {
    const identity = await getAuthenticatedIdentity();
    let actorUserId: string | null = null;
    if (identity) {
      const appUser = await identityStore.findByAuthUserId(identity.authUserId);
      actorUserId = appUser?.id ?? null;
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.error({ event: "auth.logout_failed" }, "Logout identity provider error");
      return { ok: false, error: GENERIC_LOGOUT_FAILURE };
    }

    logger.info({ event: "auth.logout_succeeded" }, "Logout succeeded");
    await recordAuditEventBestEffort(
      {
        actorType: actorUserId ? "USER" : "SYSTEM",
        actorUserId,
        entityType: AuditEntityTypes.SESSION,
        entityId: actorUserId,
        action: AuditActions.LOGOUT_SUCCEEDED,
        ipAddress: deps.ipAddress ?? null,
        userAgent: deps.userAgent ?? null,
      },
      auditWriter,
    );
    return { ok: true };
  } catch {
    logger.error({ event: "auth.logout_unavailable" }, "Logout failed");
    return { ok: false, error: GENERIC_LOGOUT_FAILURE };
  }
}

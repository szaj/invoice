import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import {
  ACCOUNT_SUSPENDED_MESSAGE,
  USER_COMPANY_ASSIGNMENT_INVALID,
  USER_EMAIL_IN_USE_MESSAGE,
  USER_INVALID_INPUT,
  USER_MANAGEMENT_UNAVAILABLE,
  USER_NOT_FOUND_MESSAGE,
  type ManagedUser,
} from "@/domain/users/types";
import {
  createUserSchema,
  updateUserSchema,
  type UpdateUserInput,
} from "@/domain/users/user-schema";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import {
  PrismaUserManagementStore,
  SupabaseAuthUserProvisioning,
  type AuthUserProvisioning,
} from "@/server/users/user-repository";

export type UserManagementResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 409 | 503; error: string };

export interface UserManagementDependencies {
  readonly store: PrismaUserManagementStore;
  readonly authProvisioning: AuthUserProvisioning;
  readonly auditWriter?: AuditWriter;
}

export function createDefaultUserManagementDependencies(): UserManagementDependencies {
  return {
    store: new PrismaUserManagementStore(),
    authProvisioning: new SupabaseAuthUserProvisioning(),
  };
}

function auditWriterOf(deps: UserManagementDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function requireUserManage(actor: AuthorizationPrincipal | null) {
  assertPermission(actor, "user.manage");
}

export async function listManagedUsers(
  actor: AuthorizationPrincipal | null,
  deps: UserManagementDependencies = createDefaultUserManagementDependencies(),
): Promise<UserManagementResult<ManagedUser[]>> {
  try {
    requireUserManage(actor);
    const users = await deps.store.listUsers();
    return { ok: true, data: users };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function getManagedUser(
  actor: AuthorizationPrincipal | null,
  userId: string,
  deps: UserManagementDependencies = createDefaultUserManagementDependencies(),
): Promise<UserManagementResult<ManagedUser>> {
  try {
    requireUserManage(actor);
    const user = await deps.store.getUserById(userId);
    if (!user) {
      return { ok: false, status: 404, error: USER_NOT_FOUND_MESSAGE };
    }
    return { ok: true, data: user };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function createManagedUser(
  actor: AuthorizationPrincipal | null,
  input: unknown,
  deps: UserManagementDependencies = createDefaultUserManagementDependencies(),
): Promise<UserManagementResult<ManagedUser>> {
  try {
    requireUserManage(actor);
    if (!actor) {
      return {
        ok: false,
        status: 403,
        error: "You do not have permission to perform this action.",
      };
    }

    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: USER_INVALID_INPUT };
    }

    const data = parsed.data;
    if (await deps.store.emailExists(data.email)) {
      return { ok: false, status: 409, error: USER_EMAIL_IN_USE_MESSAGE };
    }

    const roleId = await deps.store.findRoleIdByCode(data.roleCode);
    if (!roleId) {
      return { ok: false, status: 503, error: USER_MANAGEMENT_UNAVAILABLE };
    }

    const provisioned = await deps.authProvisioning.createAuthUser({
      email: data.email,
      name: data.name,
    });

    if (!provisioned.ok) {
      if (provisioned.reason === "email_exists") {
        return { ok: false, status: 409, error: USER_EMAIL_IN_USE_MESSAGE };
      }
      logger.error({ event: "users.create_auth_failed" }, "Auth user provisioning failed");
      return { ok: false, status: 503, error: USER_MANAGEMENT_UNAVAILABLE };
    }

    try {
      const created = await deps.store.createUser(
        provisioned.authUserId,
        {
          name: data.name,
          email: data.email,
          roleCode: data.roleCode,
          employeeId: data.employeeId,
          mfaEnabled: data.mfaEnabled,
          passwordResetRequired: data.passwordResetRequired,
          status: data.status,
          createdByUserId: actor.userId,
        },
        roleId,
      );

      const assigned = await replaceAssignmentsOrInvalid(deps, created.id, data.companyIds);
      if (!assigned.ok) {
        await deps.store.replaceAssignedCompanyIds(created.id, []);
        return assigned;
      }

      const user = { ...created, companyIds: assigned.data };
      await recordAuditEventRequired(
        {
          actorType: "USER",
          actorUserId: actor.userId,
          entityType: AuditEntityTypes.USER,
          entityId: user.id,
          action: AuditActions.USER_CREATED,
          newValues: {
            name: user.name,
            email: user.email,
            roleCode: user.roleCode,
            status: user.status,
            employeeId: user.employeeId,
            mfaEnabled: user.mfaEnabled,
            companyIds: user.companyIds,
          },
        },
        auditWriterOf(deps),
      );

      logger.info(
        {
          event: "users.created",
          actorUserId: actor.userId,
          userId: created.id,
          roleCode: created.roleCode,
          assignedCompanyCount: assigned.data.length,
        },
        "User created",
      );

      return { ok: true, data: user };
    } catch (error) {
      await deps.authProvisioning.deleteAuthUser(provisioned.authUserId);
      logger.error(
        {
          event: "users.create_failed",
          err: error instanceof Error ? error.message : "unknown",
        },
        "Application user create failed after Auth provisioning",
      );
      return { ok: false, status: 503, error: USER_MANAGEMENT_UNAVAILABLE };
    }
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function updateManagedUser(
  actor: AuthorizationPrincipal | null,
  userId: string,
  input: unknown,
  deps: UserManagementDependencies = createDefaultUserManagementDependencies(),
): Promise<UserManagementResult<ManagedUser>> {
  try {
    requireUserManage(actor);
    if (!actor) {
      return {
        ok: false,
        status: 403,
        error: "You do not have permission to perform this action.",
      };
    }

    const parsed = updateUserSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: USER_INVALID_INPUT };
    }

    const existing = await deps.store.getUserById(userId);
    if (!existing) {
      return { ok: false, status: 404, error: USER_NOT_FOUND_MESSAGE };
    }

    const data: UpdateUserInput = parsed.data;
    if (await deps.store.emailExists(data.email, userId)) {
      return { ok: false, status: 409, error: USER_EMAIL_IN_USE_MESSAGE };
    }

    const roleId = await deps.store.findRoleIdByCode(data.roleCode);
    if (!roleId) {
      return { ok: false, status: 503, error: USER_MANAGEMENT_UNAVAILABLE };
    }

    if (data.email !== existing.email) {
      const updatedAuth = await deps.authProvisioning.updateAuthUser({
        authUserId: existing.supabaseAuthUserId,
        email: data.email,
      });
      if (!updatedAuth.ok) {
        if (updatedAuth.reason === "email_exists") {
          return { ok: false, status: 409, error: USER_EMAIL_IN_USE_MESSAGE };
        }
        return { ok: false, status: 503, error: USER_MANAGEMENT_UNAVAILABLE };
      }
    }

    const updated = await deps.store.updateUser(
      userId,
      {
        name: data.name,
        email: data.email,
        roleCode: data.roleCode,
        employeeId: data.employeeId ?? null,
        mfaEnabled: data.mfaEnabled,
        status: data.status,
        passwordResetRequired: data.passwordResetRequired,
      },
      roleId,
    );

    const assigned = await replaceAssignmentsOrInvalid(deps, userId, data.companyIds);
    if (!assigned.ok) {
      return assigned;
    }

    const user = { ...updated, companyIds: assigned.data };
    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        entityType: AuditEntityTypes.USER,
        entityId: user.id,
        action: AuditActions.USER_UPDATED,
        oldValues: {
          name: existing.name,
          email: existing.email,
          roleCode: existing.roleCode,
          status: existing.status,
          employeeId: existing.employeeId,
          mfaEnabled: existing.mfaEnabled,
          passwordResetRequired: existing.passwordResetRequired,
          companyIds: existing.companyIds,
        },
        newValues: {
          name: user.name,
          email: user.email,
          roleCode: user.roleCode,
          status: user.status,
          employeeId: user.employeeId,
          mfaEnabled: user.mfaEnabled,
          passwordResetRequired: user.passwordResetRequired,
          companyIds: user.companyIds,
        },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "users.updated",
        actorUserId: actor.userId,
        userId: updated.id,
        roleCode: updated.roleCode,
        status: updated.status,
        assignedCompanyCount: assigned.data.length,
      },
      "User updated",
    );

    return { ok: true, data: user };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function suspendManagedUser(
  actor: AuthorizationPrincipal | null,
  userId: string,
  deps: UserManagementDependencies = createDefaultUserManagementDependencies(),
): Promise<UserManagementResult<ManagedUser>> {
  try {
    requireUserManage(actor);
    if (!actor) {
      return {
        ok: false,
        status: 403,
        error: "You do not have permission to perform this action.",
      };
    }

    if (actor.userId === userId) {
      return { ok: false, status: 400, error: "You cannot suspend your own account." };
    }

    const existing = await deps.store.getUserById(userId);
    if (!existing) {
      return { ok: false, status: 404, error: USER_NOT_FOUND_MESSAGE };
    }

    const updated = await deps.store.setStatus(userId, "SUSPENDED");
    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        entityType: AuditEntityTypes.USER,
        entityId: userId,
        action: AuditActions.USER_SUSPENDED,
        oldValues: { status: existing.status },
        newValues: { status: updated.status },
      },
      auditWriterOf(deps),
    );
    logger.info({ event: "users.suspended", actorUserId: actor.userId, userId }, "User suspended");
    return { ok: true, data: updated };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function resetManagedUserPassword(
  actor: AuthorizationPrincipal | null,
  userId: string,
  deps: UserManagementDependencies = createDefaultUserManagementDependencies(),
): Promise<UserManagementResult<{ user: ManagedUser; recoveryRequested: boolean }>> {
  try {
    requireUserManage(actor);
    if (!actor) {
      return {
        ok: false,
        status: 403,
        error: "You do not have permission to perform this action.",
      };
    }

    const existing = await deps.store.getUserById(userId);
    if (!existing) {
      return { ok: false, status: 404, error: USER_NOT_FOUND_MESSAGE };
    }

    const updated = await deps.store.setPasswordResetRequired(userId, true);
    const recovery = await deps.authProvisioning.sendPasswordRecovery({ email: existing.email });

    logger.info(
      {
        event: "users.password_reset_required",
        actorUserId: actor.userId,
        userId,
        recoveryRequested: recovery.ok,
      },
      "Admin password reset required set",
    );

    return {
      ok: true,
      data: {
        user: updated,
        recoveryRequested: recovery.ok,
      },
    };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export { ACCOUNT_SUSPENDED_MESSAGE };

export async function listAssignableCompanies(
  actor: AuthorizationPrincipal | null,
  deps: UserManagementDependencies = createDefaultUserManagementDependencies(),
): Promise<
  UserManagementResult<Array<{ id: string; displayName: string; status: "ACTIVE" | "INACTIVE" }>>
> {
  try {
    requireUserManage(actor);
    const companies = await deps.store.listAssignableCompanies();
    return { ok: true, data: companies };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

async function replaceAssignmentsOrInvalid(
  deps: UserManagementDependencies,
  userId: string,
  companyIds: readonly string[],
): Promise<UserManagementResult<readonly string[]>> {
  if (!(await deps.store.companiesExist(companyIds))) {
    return { ok: false, status: 400, error: USER_COMPANY_ASSIGNMENT_INVALID };
  }
  const assigned = await deps.store.replaceAssignedCompanyIds(userId, companyIds);
  return { ok: true, data: assigned };
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
    { event: "users.unavailable", err: error instanceof Error ? error.message : "unknown" },
    "User management failed",
  );
  return { ok: false, status: 503, error: USER_MANAGEMENT_UNAVAILABLE };
}

import "server-only";

import { randomBytes } from "node:crypto";

import type { RoleCode } from "@/domain/authz/roles";
import type { ManagedUser, ManagedUserStatus } from "@/domain/users/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { getPrisma } from "@/server/db/client";
import { buildRecoveryCallbackUrl, getApplicationBaseUrl } from "@/domain/auth/redirect";
import { getEnv } from "@/config/env";

export interface CreateManagedUserRecordInput {
  readonly name: string;
  readonly email: string;
  readonly roleCode: RoleCode;
  readonly employeeId?: string;
  readonly mfaEnabled: boolean;
  readonly passwordResetRequired: boolean;
  readonly status: ManagedUserStatus;
  readonly createdByUserId: string;
}

export interface UpdateManagedUserRecordInput {
  readonly name: string;
  readonly email: string;
  readonly roleCode: RoleCode;
  readonly employeeId: string | null;
  readonly mfaEnabled: boolean;
  readonly status: ManagedUserStatus;
  readonly passwordResetRequired: boolean;
}

export interface AuthUserProvisioning {
  createAuthUser(input: {
    email: string;
    name: string;
  }): Promise<
    { ok: true; authUserId: string } | { ok: false; reason: "email_exists" | "unavailable" }
  >;
  updateAuthUser(input: {
    authUserId: string;
    email: string;
  }): Promise<{ ok: true } | { ok: false; reason: "email_exists" | "unavailable" }>;
  sendPasswordRecovery(input: {
    email: string;
  }): Promise<{ ok: true } | { ok: false; reason: "unavailable" }>;
  deleteAuthUser(authUserId: string): Promise<void>;
}

function toManagedUser(user: {
  id: string;
  name: string;
  email: string;
  supabaseAuthUserId: string;
  status: ManagedUserStatus;
  employeeId: string | null;
  mfaEnabled: boolean;
  lastLoginAt: Date | null;
  passwordResetRequired: boolean;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  role: { code: RoleCode; name: string } | null;
  companies: Array<{ companyId: string }>;
}): ManagedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    supabaseAuthUserId: user.supabaseAuthUserId,
    status: user.status,
    roleCode: user.role?.code ?? null,
    roleName: user.role?.name ?? null,
    employeeId: user.employeeId,
    mfaEnabled: user.mfaEnabled,
    lastLoginAt: user.lastLoginAt,
    passwordResetRequired: user.passwordResetRequired,
    createdByUserId: user.createdByUserId,
    companyIds: user.companies.map((assignment) => assignment.companyId),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

const userInclude = {
  role: { select: { code: true, name: true } },
  companies: { select: { companyId: true } },
} as const;

export class PrismaUserManagementStore {
  async listUsers(): Promise<ManagedUser[]> {
    const prisma = getPrisma();
    const users = await prisma.user.findMany({
      include: userInclude,
      orderBy: [{ name: "asc" }, { email: "asc" }],
    });
    return users.map((user) => toManagedUser(user));
  }

  async getUserById(id: string): Promise<ManagedUser | null> {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id },
      include: userInclude,
    });
    return user ? toManagedUser(user) : null;
  }

  async findRoleIdByCode(code: RoleCode): Promise<string | null> {
    const prisma = getPrisma();
    const role = await prisma.role.findUnique({ where: { code } });
    return role?.id ?? null;
  }

  async emailExists(email: string, excludingUserId?: string): Promise<boolean> {
    const prisma = getPrisma();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      return false;
    }
    return excludingUserId ? existing.id !== excludingUserId : true;
  }

  async createUser(
    authUserId: string,
    input: CreateManagedUserRecordInput,
    roleId: string,
  ): Promise<ManagedUser> {
    const prisma = getPrisma();
    const created = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        supabaseAuthUserId: authUserId,
        status: input.status,
        roleId,
        employeeId: input.employeeId,
        mfaEnabled: input.mfaEnabled,
        passwordResetRequired: input.passwordResetRequired,
        createdByUserId: input.createdByUserId,
      },
      include: userInclude,
    });
    return toManagedUser(created);
  }

  async updateUser(
    id: string,
    input: UpdateManagedUserRecordInput,
    roleId: string,
  ): Promise<ManagedUser> {
    const prisma = getPrisma();
    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: input.name,
        email: input.email,
        status: input.status,
        roleId,
        employeeId: input.employeeId,
        mfaEnabled: input.mfaEnabled,
        passwordResetRequired: input.passwordResetRequired,
      },
      include: userInclude,
    });
    return toManagedUser(updated);
  }

  async setStatus(id: string, status: ManagedUserStatus): Promise<ManagedUser> {
    const prisma = getPrisma();
    const updated = await prisma.user.update({
      where: { id },
      data: { status },
      include: userInclude,
    });
    return toManagedUser(updated);
  }

  async setPasswordResetRequired(id: string, required: boolean): Promise<ManagedUser> {
    const prisma = getPrisma();
    const updated = await prisma.user.update({
      where: { id },
      data: { passwordResetRequired: required },
      include: userInclude,
    });
    return toManagedUser(updated);
  }

  async listAssignedCompanyIds(userId: string): Promise<string[]> {
    const prisma = getPrisma();
    const rows = await prisma.userCompany.findMany({
      where: { userId },
      select: { companyId: true },
      orderBy: { companyId: "asc" },
    });
    return rows.map((row) => row.companyId);
  }

  async companiesExist(companyIds: readonly string[]): Promise<boolean> {
    if (companyIds.length === 0) {
      return true;
    }
    const prisma = getPrisma();
    const count = await prisma.company.count({
      where: { id: { in: [...companyIds] } },
    });
    return count === companyIds.length;
  }

  async replaceAssignedCompanyIds(
    userId: string,
    companyIds: readonly string[],
  ): Promise<string[]> {
    const uniqueIds = [...new Set(companyIds)];
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      await tx.userCompany.deleteMany({ where: { userId } });
      if (uniqueIds.length > 0) {
        await tx.userCompany.createMany({
          data: uniqueIds.map((companyId) => ({ userId, companyId })),
        });
      }
    });
    return uniqueIds;
  }

  async listAssignableCompanies(): Promise<
    Array<{ id: string; displayName: string; status: "ACTIVE" | "INACTIVE" }>
  > {
    const prisma = getPrisma();
    return prisma.company.findMany({
      select: { id: true, displayName: true, status: true },
      orderBy: [{ displayName: "asc" }, { createdAt: "asc" }],
    });
  }
}

export class SupabaseAuthUserProvisioning implements AuthUserProvisioning {
  async createAuthUser(input: {
    email: string;
    name: string;
  }): Promise<
    { ok: true; authUserId: string } | { ok: false; reason: "email_exists" | "unavailable" }
  > {
    try {
      const admin = createSupabaseAdminClient();
      const temporaryPassword = randomBytes(24).toString("base64url");
      const { data, error } = await admin.auth.admin.createUser({
        email: input.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          full_name: input.name,
        },
      });

      if (error) {
        if (/already|registered|exists/i.test(error.message)) {
          return { ok: false, reason: "email_exists" };
        }
        return { ok: false, reason: "unavailable" };
      }

      if (!data.user?.id) {
        return { ok: false, reason: "unavailable" };
      }

      return { ok: true, authUserId: data.user.id };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  }

  async updateAuthUser(input: {
    authUserId: string;
    email: string;
  }): Promise<{ ok: true } | { ok: false; reason: "email_exists" | "unavailable" }> {
    try {
      const admin = createSupabaseAdminClient();
      const { error } = await admin.auth.admin.updateUserById(input.authUserId, {
        email: input.email,
        email_confirm: true,
      });

      if (error) {
        if (/already|registered|exists/i.test(error.message)) {
          return { ok: false, reason: "email_exists" };
        }
        return { ok: false, reason: "unavailable" };
      }

      return { ok: true };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  }

  async sendPasswordRecovery(input: {
    email: string;
  }): Promise<{ ok: true } | { ok: false; reason: "unavailable" }> {
    try {
      const env = getEnv();
      const redirectTo = buildRecoveryCallbackUrl(
        getApplicationBaseUrl({ appUrl: env.APP_URL, appEnv: env.APP_ENV }),
      );
      const { createClient } = await import("@supabase/supabase-js");
      const { requireSupabasePublicConfig } = await import("@/config/env");
      const { url, anonKey } = requireSupabasePublicConfig(env);
      const client = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await client.auth.resetPasswordForEmail(input.email, { redirectTo });

      if (error) {
        return { ok: false, reason: "unavailable" };
      }

      return { ok: true };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  }

  async deleteAuthUser(authUserId: string): Promise<void> {
    try {
      const admin = createSupabaseAdminClient();
      await admin.auth.admin.deleteUser(authUserId);
    } catch {
      // Best-effort cleanup after a failed application insert.
    }
  }
}

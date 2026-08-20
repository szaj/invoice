import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import type { ManagedUser } from "@/domain/users/types";
import type { RoleCode } from "@/domain/authz/roles";
import {
  createManagedUser,
  listManagedUsers,
  resetManagedUserPassword,
  suspendManagedUser,
  updateManagedUser,
  type UserManagementDependencies,
} from "@/server/users/user-service";
import type { AuthUserProvisioning } from "@/server/users/user-repository";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

function principal(roleCode: RoleCode | null): AuthorizationPrincipal {
  return {
    userId: "actor-1",
    status: "ACTIVE",
    roleCode,
  };
}

function managedUser(overrides: Partial<ManagedUser> = {}): ManagedUser {
  return {
    id: "user-1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    supabaseAuthUserId: "11111111-1111-1111-1111-111111111111",
    status: "ACTIVE",
    roleCode: "STAFF",
    roleName: "Staff",
    employeeId: null,
    mfaEnabled: false,
    lastLoginAt: null,
    passwordResetRequired: true,
    createdByUserId: "actor-1",
    companyIds: [],
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    ...overrides,
  };
}

function createDeps(options?: {
  users?: ManagedUser[];
  authFail?: "email_exists" | "unavailable";
}): UserManagementDependencies & {
  store: {
    users: ManagedUser[];
  };
} {
  const users = options?.users ? [...options.users] : [];
  const roleIds: Record<RoleCode, string> = {
    ADMIN: "role-admin",
    COMPLIANCE: "role-compliance",
    STAFF: "role-staff",
  };

  const authProvisioning: AuthUserProvisioning = {
    async createAuthUser() {
      if (options?.authFail) {
        return { ok: false, reason: options.authFail };
      }
      return { ok: true, authUserId: "22222222-2222-4222-8222-222222222222" };
    },
    async updateAuthUser() {
      return { ok: true };
    },
    async sendPasswordRecovery() {
      return { ok: true };
    },
    async deleteAuthUser() {},
  };

  const store = {
    users,
    async listUsers() {
      return users;
    },
    async getUserById(id: string) {
      return users.find((user) => user.id === id) ?? null;
    },
    async findRoleIdByCode(code: RoleCode) {
      return roleIds[code];
    },
    async emailExists(email: string, excludingUserId?: string) {
      return users.some((user) => user.email === email && user.id !== excludingUserId);
    },
    async createUser(
      authUserId: string,
      input: {
        name: string;
        email: string;
        roleCode: RoleCode;
        employeeId?: string;
        mfaEnabled: boolean;
        passwordResetRequired: boolean;
        status: "ACTIVE" | "SUSPENDED";
        createdByUserId: string;
      },
    ) {
      const created = managedUser({
        id: "created-1",
        name: input.name,
        email: input.email,
        supabaseAuthUserId: authUserId,
        roleCode: input.roleCode,
        roleName: input.roleCode,
        employeeId: input.employeeId ?? null,
        mfaEnabled: input.mfaEnabled,
        passwordResetRequired: input.passwordResetRequired,
        status: input.status,
        createdByUserId: input.createdByUserId,
      });
      users.push(created);
      return created;
    },
    async updateUser(
      id: string,
      input: {
        name: string;
        email: string;
        roleCode: RoleCode;
        employeeId: string | null;
        mfaEnabled: boolean;
        status: "ACTIVE" | "SUSPENDED";
        passwordResetRequired: boolean;
      },
    ) {
      const index = users.findIndex((user) => user.id === id);
      const updated = managedUser({
        ...users[index],
        ...input,
        roleName: input.roleCode,
        id,
      });
      users[index] = updated;
      return updated;
    },
    async setStatus(id: string, status: "ACTIVE" | "SUSPENDED") {
      const index = users.findIndex((user) => user.id === id);
      const current = users[index];
      if (!current) {
        throw new Error("user not found");
      }
      const updated: ManagedUser = { ...current, status };
      users[index] = updated;
      return updated;
    },
    async setPasswordResetRequired(id: string, required: boolean) {
      const index = users.findIndex((user) => user.id === id);
      const current = users[index];
      if (!current) {
        throw new Error("user not found");
      }
      const updated: ManagedUser = { ...current, passwordResetRequired: required };
      users[index] = updated;
      return updated;
    },
    async listAssignedCompanyIds(userId: string) {
      return users.find((user) => user.id === userId)?.companyIds ?? [];
    },
    async companiesExist() {
      return true;
    },
    async replaceAssignedCompanyIds(userId: string, companyIds: readonly string[]) {
      const index = users.findIndex((user) => user.id === userId);
      const current = users[index];
      if (current) {
        users[index] = { ...current, companyIds: [...companyIds] };
      }
      return [...companyIds];
    },
    async listAssignableCompanies() {
      return [];
    },
  };

  return {
    store: store as unknown as UserManagementDependencies["store"] & { users: ManagedUser[] },
    authProvisioning,
    auditWriter: createMemoryAuditWriter(),
  };
}

describe("user management authorization", () => {
  it("allows Admin to list users and denies Compliance and Staff", async () => {
    const deps = createDeps({ users: [managedUser()] });

    const admin = await listManagedUsers(principal("ADMIN"), deps);
    expect(admin.ok).toBe(true);

    for (const role of ["COMPLIANCE", "STAFF"] as const) {
      const denied = await listManagedUsers(principal(role), deps);
      expect(denied.ok).toBe(false);
      if (!denied.ok) {
        expect(denied.status).toBe(403);
        expect(denied.error).toBe(GENERIC_FORBIDDEN);
      }
    }
  });

  it("creates a user for Admin without treating passwordResetRequired as a permission", async () => {
    const deps = createDeps();
    const result = await createManagedUser(
      principal("ADMIN"),
      {
        name: "Grace Hopper",
        email: "grace@example.com",
        roleCode: "COMPLIANCE",
        passwordResetRequired: true,
      },
      deps,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.roleCode).toBe("COMPLIANCE");
      expect(result.data.passwordResetRequired).toBe(true);
      expect(result.data).not.toHaveProperty("permissions");
    }
  });

  it("denies non-Admin create and update", async () => {
    const deps = createDeps({ users: [managedUser()] });
    const created = await createManagedUser(
      principal("STAFF"),
      { name: "X", email: "x@example.com", roleCode: "STAFF" },
      deps,
    );
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.status).toBe(403);
    }

    const updated = await updateManagedUser(
      principal("COMPLIANCE"),
      "user-1",
      {
        name: "Ada Lovelace",
        email: "ada@example.com",
        roleCode: "STAFF",
        employeeId: null,
        mfaEnabled: false,
        status: "ACTIVE",
        passwordResetRequired: false,
      },
      deps,
    );
    expect(updated.ok).toBe(false);
    if (!updated.ok) {
      expect(updated.status).toBe(403);
    }
  });

  it("suspends a user and refuses self-suspension", async () => {
    const deps = createDeps({
      users: [
        managedUser({ id: "actor-1" }),
        managedUser({ id: "user-2", email: "other@example.com" }),
      ],
    });

    const self = await suspendManagedUser(principal("ADMIN"), "actor-1", deps);
    expect(self.ok).toBe(false);
    if (!self.ok) {
      expect(self.status).toBe(400);
    }

    const other = await suspendManagedUser(principal("ADMIN"), "user-2", deps);
    expect(other.ok).toBe(true);
    if (other.ok) {
      expect(other.data.status).toBe("SUSPENDED");
    }
  });

  it("sets password reset required as workflow state on Admin reset", async () => {
    const deps = createDeps({ users: [managedUser({ passwordResetRequired: false })] });
    const result = await resetManagedUserPassword(principal("ADMIN"), "user-1", deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.user.passwordResetRequired).toBe(true);
      expect(result.data.recoveryRequested).toBe(true);
    }
  });
});

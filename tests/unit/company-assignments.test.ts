import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  assertCompanyAccess,
  authorizeCompanyAccess,
  canAccessCompany,
} from "@/domain/authz/company-access";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import type { RoleCode } from "@/domain/authz/roles";
import { getCompany } from "@/server/companies/company-service";
import type { CompanyRecord } from "@/domain/companies/types";
import {
  createManagedUser,
  listAssignableCompanies,
  updateManagedUser,
  type UserManagementDependencies,
} from "@/server/users/user-service";
import type { AuthUserProvisioning } from "@/server/users/user-repository";
import type { ManagedUser } from "@/domain/users/types";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

const ASSIGNED_COMPANY = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY = "22222222-2222-4222-8222-222222222222";

function principal(
  roleCode: RoleCode | null,
  assignedCompanyIds: readonly string[] = [],
): AuthorizationPrincipal {
  return {
    userId: "actor-1",
    status: "ACTIVE",
    roleCode,
    assignedCompanyIds,
  };
}

describe("company assignment access", () => {
  it("lets Admin access any company without assignment rows", () => {
    const admin = principal("ADMIN", []);
    expect(canAccessCompany(admin, OTHER_COMPANY)).toBe(true);
    expect(assertCompanyAccess(admin, OTHER_COMPANY)).toBe("ADMIN");
  });

  it("lets Staff access assigned companies and denies unassigned company data", () => {
    const staff = principal("STAFF", [ASSIGNED_COMPANY]);
    expect(authorizeCompanyAccess(staff, ASSIGNED_COMPANY)).toEqual({ allowed: true });
    const denied = authorizeCompanyAccess(staff, OTHER_COMPANY);
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) {
      expect(denied.reason).toBe("denied");
    }
    expect(() => assertCompanyAccess(staff, OTHER_COMPANY)).toThrow(GENERIC_FORBIDDEN);
  });

  it("does not treat reporting-group membership as authorization", () => {
    const staff = principal("STAFF", [ASSIGNED_COMPANY]);
    const withGroup = {
      ...staff,
      reportingGroupId: "vx-group",
    } as AuthorizationPrincipal & { reportingGroupId: string };
    expect(canAccessCompany(withGroup, OTHER_COMPANY)).toBe(false);
  });
});

function companyRecord(id: string): CompanyRecord {
  return {
    id,
    displayName: id === ASSIGNED_COMPANY ? "Assigned Brand" : "Other Brand",
    legalName: null,
    email: null,
    phone: null,
    website: null,
    registrationTaxNumber: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    region: null,
    postalCode: null,
    countryCode: null,
    status: "ACTIVE",
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
  };
}

describe("staff company data authorization", () => {
  it("allows Staff GET of an assigned company and denies unassigned", async () => {
    const companies = [companyRecord(ASSIGNED_COMPANY), companyRecord(OTHER_COMPANY)];
    const deps = {
      store: {
        async listCompanies() {
          return companies;
        },
        async getCompanyById(id: string) {
          return companies.find((company) => company.id === id) ?? null;
        },
        async createCompany() {
          throw new Error("not used");
        },
        async updateCompany() {
          throw new Error("not used");
        },
        async setStatus() {
          throw new Error("not used");
        },
      },
    };

    const staff = principal("STAFF", [ASSIGNED_COMPANY]);
    const assigned = await getCompany(staff, ASSIGNED_COMPANY, deps);
    expect(assigned.ok).toBe(true);

    const unassigned = await getCompany(staff, OTHER_COMPANY, deps);
    expect(unassigned.ok).toBe(false);
    if (!unassigned.ok) {
      expect(unassigned.status).toBe(403);
      expect(unassigned.error).toBe(GENERIC_FORBIDDEN);
    }
  });
});

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

function createUserDeps(): UserManagementDependencies & { store: { users: ManagedUser[] } } {
  const users: ManagedUser[] = [];
  const knownCompanies = new Set([ASSIGNED_COMPANY, OTHER_COMPANY]);
  const authProvisioning: AuthUserProvisioning = {
    async createAuthUser() {
      return { ok: true, authUserId: "33333333-3333-4333-8333-333333333333" };
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
      return `role-${code}`;
    },
    async emailExists() {
      return false;
    },
    async createUser(
      authUserId: string,
      input: { name: string; email: string; roleCode: RoleCode },
    ) {
      const created = managedUser({
        id: "created-1",
        name: input.name,
        email: input.email,
        supabaseAuthUserId: authUserId,
        roleCode: input.roleCode,
        roleName: input.roleCode,
      });
      users.push(created);
      return created;
    },
    async updateUser(id: string, input: { name: string; roleCode: RoleCode }) {
      const index = users.findIndex((user) => user.id === id);
      const updated = managedUser({ ...users[index], ...input, id, roleName: input.roleCode });
      users[index] = updated;
      return updated;
    },
    async setStatus() {
      throw new Error("not used");
    },
    async setPasswordResetRequired() {
      throw new Error("not used");
    },
    async companiesExist(companyIds: readonly string[]) {
      return companyIds.every((id) => knownCompanies.has(id));
    },
    async replaceAssignedCompanyIds(userId: string, companyIds: readonly string[]) {
      const index = users.findIndex((user) => user.id === userId);
      const current = users[index];
      if (current) {
        users[index] = { ...current, companyIds: [...companyIds] };
      }
      return [...companyIds];
    },
    async listAssignedCompanyIds(userId: string) {
      return [...(users.find((user) => user.id === userId)?.companyIds ?? [])];
    },
    async listAssignableCompanies() {
      return [
        { id: ASSIGNED_COMPANY, displayName: "Assigned Brand", status: "ACTIVE" as const },
        { id: OTHER_COMPANY, displayName: "Other Brand", status: "ACTIVE" as const },
      ];
    },
  };

  return {
    store: store as unknown as UserManagementDependencies["store"] & { users: ManagedUser[] },
    authProvisioning,
    auditWriter: createMemoryAuditWriter(),
  };
}

describe("assignment persistence", () => {
  it("persists assigned company IDs on Admin create and replace on update", async () => {
    const deps = createUserDeps();
    const created = await createManagedUser(
      principal("ADMIN"),
      {
        name: "Staff User",
        email: "staff@example.com",
        roleCode: "STAFF",
        companyIds: [ASSIGNED_COMPANY],
      },
      deps,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("create failed");
    }
    expect(created.data.companyIds).toEqual([ASSIGNED_COMPANY]);

    const updated = await updateManagedUser(
      principal("ADMIN"),
      created.data.id,
      {
        name: "Staff User",
        email: "staff@example.com",
        roleCode: "STAFF",
        employeeId: null,
        mfaEnabled: false,
        status: "ACTIVE",
        passwordResetRequired: true,
        companyIds: [ASSIGNED_COMPANY, OTHER_COMPANY],
      },
      deps,
    );
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.companyIds).toEqual([ASSIGNED_COMPANY, OTHER_COMPANY]);
    }
  });

  it("rejects unknown company IDs and non-Admin assignment listing", async () => {
    const deps = createUserDeps();
    const created = await createManagedUser(
      principal("ADMIN"),
      {
        name: "Staff User",
        email: "staff2@example.com",
        roleCode: "STAFF",
        companyIds: ["00000000-0000-4000-8000-000000000000"],
      },
      deps,
    );
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.status).toBe(400);
    }

    const listed = await listAssignableCompanies(principal("STAFF"), deps);
    expect(listed.ok).toBe(false);
    if (!listed.ok) {
      expect(listed.status).toBe(403);
    }
  });
});

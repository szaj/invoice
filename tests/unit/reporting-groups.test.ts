import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { authorizeCompanyAccess } from "@/domain/authz/company-access";
import { reportingGroupWriteSchema } from "@/domain/reporting-groups/schema";
import type { ReportingGroupRecord } from "@/domain/reporting-groups/types";
import type { RoleCode } from "@/domain/authz/roles";
import {
  createReportingGroup,
  getReportingGroup,
  listReportingGroups,
  setReportingGroupStatus,
  updateReportingGroup,
  type ReportingGroupDependencies,
} from "@/server/reporting-groups/reporting-group-service";

function principal(
  roleCode: RoleCode | null,
  assignedCompanyIds: readonly string[] = [],
): AuthorizationPrincipal {
  return {
    userId: "actor-1",
    status: "ACTIVE",
    roleCode,
    assignedCompanyIds: [...assignedCompanyIds],
  };
}

function groupRecord(overrides: Partial<ReportingGroupRecord> = {}): ReportingGroupRecord {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Example Group",
    code: "EX",
    status: "ACTIVE",
    displayOrder: 0,
    companyIds: [],
    companies: [],
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    ...overrides,
  };
}

function createDeps(options?: {
  groups?: ReportingGroupRecord[];
  knownCompanyIds?: readonly string[];
}): ReportingGroupDependencies {
  const groups = options?.groups ? [...options.groups] : [];
  const knownCompanyIds = new Set(options?.knownCompanyIds ?? []);

  return {
    store: {
      async listGroups() {
        return groups;
      },
      async getGroupById(id: string) {
        return groups.find((group) => group.id === id) ?? null;
      },
      async findByCode(code: string) {
        return groups.find((group) => group.code === code) ?? null;
      },
      async createGroup(input) {
        const members = input.companyIds.map((id) => ({
          id,
          displayName: `Company ${id.slice(0, 8)}`,
          status: "ACTIVE" as const,
        }));
        const created = groupRecord({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          name: input.name,
          code: input.code,
          status: input.status,
          displayOrder: input.displayOrder,
          companyIds: [...input.companyIds],
          companies: members,
        });
        groups.push(created);
        return created;
      },
      async updateGroup(id: string, input) {
        const index = groups.findIndex((group) => group.id === id);
        const members = input.companyIds.map((companyId) => ({
          id: companyId,
          displayName: `Company ${companyId.slice(0, 8)}`,
          status: "ACTIVE" as const,
        }));
        const updated = groupRecord({
          ...groups[index],
          id,
          name: input.name,
          code: input.code,
          status: input.status,
          displayOrder: input.displayOrder,
          companyIds: [...input.companyIds],
          companies: members,
        });
        groups[index] = updated;
        return updated;
      },
      async setStatus(id: string, status) {
        const index = groups.findIndex((group) => group.id === id);
        const current = groups[index];
        if (!current) {
          throw new Error("missing group");
        }
        const updated = { ...current, status };
        groups[index] = updated;
        return updated;
      },
      async countExistingCompanies(companyIds) {
        return companyIds.filter((id) => knownCompanyIds.has(id)).length;
      },
    },
  };
}

describe("reporting group schema", () => {
  it("accepts group fields and company assignments", () => {
    const parsed = reportingGroupWriteSchema.safeParse({
      name: "Example",
      code: "vx",
      status: "ACTIVE",
      displayOrder: 1,
      companyIds: ["11111111-1111-4111-8111-111111111111"],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.code).toBe("VX");
    }
  });

  it("rejects unknown later-task fields", () => {
    expect(
      reportingGroupWriteSchema.safeParse({
        name: "Example",
        code: "EX",
        reportEngine: true,
      }).success,
    ).toBe(false);
  });
});

describe("reporting group authorization", () => {
  it("allows Admin CRUD and denies Staff mutations", async () => {
    const companyA = "11111111-1111-4111-8111-111111111111";
    const deps = createDeps({ knownCompanyIds: [companyA] });

    const created = await createReportingGroup(
      principal("ADMIN"),
      {
        name: "Example",
        code: "EX",
        status: "ACTIVE",
        displayOrder: 0,
        companyIds: [companyA],
      },
      deps,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("create failed");
    }
    expect(created.data.companyIds).toEqual([companyA]);

    const staffCreate = await createReportingGroup(
      principal("STAFF", [companyA]),
      {
        name: "Nope",
        code: "NO",
        companyIds: [],
      },
      deps,
    );
    expect(staffCreate.ok).toBe(false);
    if (!staffCreate.ok) {
      expect(staffCreate.status).toBe(403);
      expect(staffCreate.error).toBe(GENERIC_FORBIDDEN);
    }

    const listed = await listReportingGroups(principal("STAFF", [companyA]), deps);
    expect(listed.ok).toBe(false);
  });

  it("does not grant Staff company access through reporting-group membership", async () => {
    const companyA = "11111111-1111-4111-8111-111111111111";
    const companyB = "22222222-2222-4222-8222-222222222222";
    const deps = createDeps({ knownCompanyIds: [companyA, companyB] });

    const created = await createReportingGroup(
      principal("ADMIN"),
      {
        name: "Shared Rollup",
        code: "SR",
        companyIds: [companyA, companyB],
      },
      deps,
    );
    expect(created.ok).toBe(true);

    const staff = principal("STAFF", [companyA]);
    expect(authorizeCompanyAccess(staff, companyA).allowed).toBe(true);
    expect(authorizeCompanyAccess(staff, companyB).allowed).toBe(false);

    const updated = await updateReportingGroup(
      staff,
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      {
        name: "Shared Rollup",
        code: "SR",
        companyIds: [companyA, companyB],
      },
      deps,
    );
    expect(updated.ok).toBe(false);
    if (!updated.ok) {
      expect(updated.status).toBe(403);
    }
  });

  it("updates and deactivates a group for Admin", async () => {
    const companyA = "11111111-1111-4111-8111-111111111111";
    const deps = createDeps({
      groups: [
        groupRecord({
          companyIds: [companyA],
          companies: [{ id: companyA, displayName: "A", status: "ACTIVE" }],
        }),
      ],
      knownCompanyIds: [companyA],
    });

    const updated = await updateReportingGroup(
      principal("ADMIN"),
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      {
        name: "Renamed",
        code: "RN",
        status: "ACTIVE",
        displayOrder: 2,
        companyIds: [],
      },
      deps,
    );
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.name).toBe("Renamed");
      expect(updated.data.companyIds).toEqual([]);
    }

    const deactivated = await setReportingGroupStatus(
      principal("ADMIN"),
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      { status: "INACTIVE" },
      deps,
    );
    expect(deactivated.ok).toBe(true);
    if (deactivated.ok) {
      expect(deactivated.data.status).toBe("INACTIVE");
    }

    const fetched = await getReportingGroup(
      principal("ADMIN"),
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      deps,
    );
    expect(fetched.ok).toBe(true);
  });
});

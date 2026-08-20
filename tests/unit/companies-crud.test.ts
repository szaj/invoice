import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { companyWriteSchema } from "@/domain/companies/company-schema";
import type { CompanyRecord } from "@/domain/companies/types";
import type { RoleCode } from "@/domain/authz/roles";
import {
  createCompany,
  getCompany,
  listCompanies,
  setCompanyStatus,
  updateCompany,
  type CompanyManagementDependencies,
} from "@/server/companies/company-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

function principal(roleCode: RoleCode | null): AuthorizationPrincipal {
  return {
    userId: "actor-1",
    status: "ACTIVE",
    roleCode,
  };
}

function companyRecord(overrides: Partial<CompanyRecord> = {}): CompanyRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    displayName: "Virtue Xolutions",
    legalName: "Virtue Xolutions Ltd",
    email: "hello@example.com",
    phone: "+97100000000",
    website: "https://example.com",
    registrationTaxNumber: "TRN-1",
    addressLine1: "1 Business Bay",
    addressLine2: null,
    city: "Dubai",
    region: "Dubai",
    postalCode: "00000",
    countryCode: "AE",
    status: "ACTIVE",
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    ...overrides,
  };
}

function validWrite(overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Virtue Xolutions",
    legalName: "Virtue Xolutions Ltd",
    email: "hello@example.com",
    phone: "+97100000000",
    website: "https://example.com",
    registrationTaxNumber: "TRN-1",
    addressLine1: "1 Business Bay",
    addressLine2: "",
    city: "Dubai",
    region: "Dubai",
    postalCode: "00000",
    countryCode: "AE",
    status: "ACTIVE",
    ...overrides,
  };
}

function createDeps(options?: { companies?: CompanyRecord[] }): CompanyManagementDependencies & {
  store: { companies: CompanyRecord[] };
} {
  const companies = options?.companies ? [...options.companies] : [];

  const store = {
    companies,
    async listCompanies() {
      return companies;
    },
    async getCompanyById(id: string) {
      return companies.find((company) => company.id === id) ?? null;
    },
    async createCompany(input: {
      displayName: string;
      legalName: string | null;
      email: string | null;
      phone: string | null;
      website: string | null;
      registrationTaxNumber: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      region: string | null;
      postalCode: string | null;
      countryCode: string | null;
      status: "ACTIVE" | "INACTIVE";
    }) {
      const created = companyRecord({
        id: "22222222-2222-4222-8222-222222222222",
        ...input,
      });
      companies.push(created);
      return created;
    },
    async updateCompany(id: string, input: Record<string, unknown>) {
      const index = companies.findIndex((company) => company.id === id);
      const updated = companyRecord({
        ...companies[index],
        ...input,
        id,
      });
      companies[index] = updated;
      return updated;
    },
    async setStatus(id: string, status: "ACTIVE" | "INACTIVE") {
      const index = companies.findIndex((company) => company.id === id);
      const current = companies[index];
      if (!current) {
        throw new Error("company not found");
      }
      const updated: CompanyRecord = { ...current, status };
      companies[index] = updated;
      return updated;
    },
  };

  return {
    store: store as unknown as CompanyManagementDependencies["store"] & {
      companies: CompanyRecord[];
    },
    auditWriter: createMemoryAuditWriter(),
  };
}

describe("company write schema", () => {
  it("rejects empty display names, invalid countries, and later-task fields", () => {
    expect(companyWriteSchema.safeParse({ displayName: " " }).success).toBe(false);
    expect(companyWriteSchema.safeParse(validWrite({ countryCode: "XX" })).success).toBe(false);
    expect(companyWriteSchema.safeParse(validWrite({ invoicePrefix: "VX-" })).success).toBe(false);
    expect(
      companyWriteSchema.safeParse(validWrite({ defaultInvoiceCurrency: "USD" })).success,
    ).toBe(false);
    expect(companyWriteSchema.safeParse(validWrite()).success).toBe(true);
  });
});

describe("company management authorization", () => {
  it("allows Admin to list companies and denies Compliance and Staff", async () => {
    const deps = createDeps({ companies: [companyRecord()] });

    const admin = await listCompanies(principal("ADMIN"), deps);
    expect(admin.ok).toBe(true);

    for (const role of ["COMPLIANCE", "STAFF"] as const) {
      const denied = await listCompanies(principal(role), deps);
      expect(denied.ok).toBe(false);
      if (!denied.ok) {
        expect(denied.status).toBe(403);
        expect(denied.error).toBe(GENERIC_FORBIDDEN);
      }
    }
  });

  it("creates, updates, and deactivates a company for Admin without hard-delete", async () => {
    const deps = createDeps();
    const created = await createCompany(principal("ADMIN"), validWrite(), deps);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("create failed");
    }
    expect(created.data.displayName).toBe("Virtue Xolutions");
    expect(created.data.countryCode).toBe("AE");
    expect(created.data.status).toBe("ACTIVE");
    expect(created.data).not.toHaveProperty("defaultInvoiceCurrency");

    const updated = await updateCompany(
      principal("ADMIN"),
      created.data.id,
      validWrite({ displayName: "Virtue Xolutions Updated", legalName: "" }),
      deps,
    );
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.displayName).toBe("Virtue Xolutions Updated");
      expect(updated.data.legalName).toBeNull();
    }

    const deactivated = await setCompanyStatus(
      principal("ADMIN"),
      created.data.id,
      { status: "INACTIVE" },
      deps,
    );
    expect(deactivated.ok).toBe(true);
    if (deactivated.ok) {
      expect(deactivated.data.status).toBe("INACTIVE");
    }

    const fetched = await getCompany(principal("ADMIN"), created.data.id, deps);
    expect(fetched.ok).toBe(true);
    if (fetched.ok) {
      expect(fetched.data.status).toBe("INACTIVE");
    }
  });

  it("denies non-Admin create, update, and status changes", async () => {
    const deps = createDeps({ companies: [companyRecord()] });
    const created = await createCompany(principal("STAFF"), validWrite(), deps);
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.status).toBe(403);
    }

    const updated = await updateCompany(
      principal("COMPLIANCE"),
      "11111111-1111-4111-8111-111111111111",
      validWrite({ displayName: "Nope" }),
      deps,
    );
    expect(updated.ok).toBe(false);
    if (!updated.ok) {
      expect(updated.status).toBe(403);
    }

    const status = await setCompanyStatus(
      principal("STAFF"),
      "11111111-1111-4111-8111-111111111111",
      { status: "INACTIVE" },
      deps,
    );
    expect(status.ok).toBe(false);
    if (!status.ok) {
      expect(status.status).toBe(403);
    }
  });

  it("rejects invalid company updates", async () => {
    const deps = createDeps({ companies: [companyRecord()] });
    const result = await updateCompany(
      principal("ADMIN"),
      "11111111-1111-4111-8111-111111111111",
      validWrite({ displayName: "", countryCode: "ZZ" }),
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });
});

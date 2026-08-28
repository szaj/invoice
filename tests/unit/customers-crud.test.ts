import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import type { RoleCode } from "@/domain/authz/roles";
import { canAccessCustomer, mergeCustomerCompanyLinks } from "@/domain/customers/access";
import { CUSTOMER_COMPANY_REQUIRED, type CustomerRecord } from "@/domain/customers/types";
import type { CustomerPersistedWriteInput } from "@/domain/customers/schema";
import type { CustomerListScope } from "@/server/customers/customer-repository";
import {
  createCustomer,
  getCustomer,
  linkCustomerCompany,
  listCustomers,
  setCustomerCompanies,
  setCustomerStatus,
  unlinkCustomerCompany,
  updateCustomer,
  type CustomerManagementDependencies,
} from "@/server/customers/customer-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function principal(
  roleCode: RoleCode | null,
  overrides: Partial<AuthorizationPrincipal> = {},
): AuthorizationPrincipal {
  return {
    userId: roleCode === "STAFF" ? STAFF_ID : ADMIN_ID,
    status: "ACTIVE",
    roleCode,
    assignedCompanyIds: roleCode === "ADMIN" ? [] : [COMPANY_A],
    ...overrides,
  };
}

function customerRecord(overrides: Partial<CustomerRecord> = {}): CustomerRecord {
  return {
    id: "dddddddd-dddd-4ddd-8ddd-000000000001",
    displayName: "Acme Trading",
    contactPerson: null,
    customerType: "BUSINESS",
    email: "acme@example.com",
    phone: null,
    alternatePhone: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    region: null,
    postalCode: null,
    countryCode: null,
    taxRegistrationId: null,
    website: null,
    defaultInvoiceCurrencyCode: null,
    defaultCompanyId: COMPANY_A,
    paymentPreference: null,
    status: "ACTIVE",
    complianceStatus: "NOT_REVIEWED",
    assignedStaffUserId: STAFF_ID,
    internalNotes: null,
    tags: [],
    companyIds: [COMPANY_A],
    createdByUserId: ADMIN_ID,
    updatedByUserId: ADMIN_ID,
    createdAt: new Date("2026-08-21T00:00:00.000Z"),
    updatedAt: new Date("2026-08-21T00:00:00.000Z"),
    ...overrides,
  };
}

function createDeps(seed: CustomerRecord[] = []): CustomerManagementDependencies & {
  store: { customers: CustomerRecord[] };
} {
  const customers = [...seed];
  const store = {
    customers,
    async listCustomersPage(_scope: CustomerListScope, search: { page: number; pageSize: number }) {
      const start = (search.page - 1) * search.pageSize;
      const rows = customers.slice(start, start + search.pageSize);
      return { rows, totalCount: customers.length };
    },
    async getCustomerById(id: string) {
      return customers.find((row) => row.id === id) ?? null;
    },
    async createCustomer(
      input: CustomerPersistedWriteInput,
      companyIds: readonly string[],
      actor?: { createdByUserId?: string | null },
    ) {
      const created = customerRecord({
        id: "dddddddd-dddd-4ddd-8ddd-000000000099",
        ...input,
        tags: [...input.tags],
        companyIds: [...companyIds],
        createdByUserId: actor?.createdByUserId ?? null,
        updatedByUserId: actor?.createdByUserId ?? null,
      });
      customers.push(created);
      return created;
    },
    async updateCustomer(
      id: string,
      input: CustomerPersistedWriteInput,
      companyIds: readonly string[],
      actor?: { updatedByUserId?: string | null },
    ) {
      const index = customers.findIndex((row) => row.id === id);
      const updated = customerRecord({
        ...customers[index],
        ...input,
        id,
        tags: [...input.tags],
        companyIds: [...companyIds],
        updatedByUserId: actor?.updatedByUserId ?? null,
      });
      customers[index] = updated;
      return updated;
    },
    async setCustomerCompanies(
      id: string,
      companyIds: readonly string[],
      actor?: { updatedByUserId?: string | null },
    ) {
      const index = customers.findIndex((row) => row.id === id);
      const updated = customerRecord({
        ...customers[index],
        companyIds: [...companyIds],
        updatedByUserId: actor?.updatedByUserId ?? customers[index]?.updatedByUserId ?? null,
      });
      customers[index] = updated;
      return updated;
    },
    async setStatus(
      id: string,
      status: "ACTIVE" | "INACTIVE",
      actor?: { updatedByUserId?: string | null },
    ) {
      const index = customers.findIndex((row) => row.id === id);
      const updated = customerRecord({
        ...customers[index],
        status,
        updatedByUserId: actor?.updatedByUserId ?? customers[index]?.updatedByUserId ?? null,
      });
      customers[index] = updated;
      return updated;
    },
    async findPotentialDuplicates(input: {
      readonly displayName: string;
      readonly email: string | null;
      readonly phone: string | null;
      readonly excludeCustomerId?: string | null;
    }) {
      const name = input.displayName.trim().toLowerCase();
      const email = input.email?.trim().toLowerCase() ?? null;
      const phone = input.phone?.trim() ?? null;
      return customers
        .filter((row) => {
          if (input.excludeCustomerId && row.id === input.excludeCustomerId) {
            return false;
          }
          if (row.displayName.trim().toLowerCase() === name) {
            return true;
          }
          if (email && row.email?.trim().toLowerCase() === email) {
            return true;
          }
          if (phone && row.phone?.trim() === phone) {
            return true;
          }
          return false;
        })
        .map((row) => ({
          id: row.id,
          displayName: row.displayName,
          email: row.email,
          phone: row.phone,
          status: row.status,
        }));
    },
  };

  return {
    store,
    auditWriter: createMemoryAuditWriter(),
  };
}

describe("customer access via company links", () => {
  it("allows Admin all customers and Staff only when a linked company intersects assignment", () => {
    const row = customerRecord();
    expect(canAccessCustomer(principal("ADMIN"), row)).toBe(true);
    expect(canAccessCustomer(principal("STAFF"), row)).toBe(true);
    expect(canAccessCustomer(principal("STAFF"), customerRecord({ companyIds: [COMPANY_B] }))).toBe(
      false,
    );
    expect(
      canAccessCustomer(
        principal("STAFF"),
        customerRecord({ companyIds: [COMPANY_B], assignedStaffUserId: STAFF_ID }),
      ),
    ).toBe(false);
  });

  it("preserves Admin-only links when Staff merges companyIds", () => {
    expect(
      mergeCustomerCompanyLinks({
        actor: principal("STAFF"),
        existingCompanyIds: [COMPANY_A, COMPANY_B],
        requestedCompanyIds: [COMPANY_A],
      }).sort(),
    ).toEqual([COMPANY_A, COMPANY_B].sort());

    expect(
      mergeCustomerCompanyLinks({
        actor: principal("ADMIN"),
        existingCompanyIds: [COMPANY_A, COMPANY_B],
        requestedCompanyIds: [COMPANY_A],
      }),
    ).toEqual([COMPANY_A]);
  });
});

describe("customer CRUD authorization", () => {
  it("allows Admin create/list and soft-deactivate; denies Staff deactivate", async () => {
    const deps = createDeps();
    const created = await createCustomer(
      principal("ADMIN"),
      {
        displayName: "Acme Trading",
        customerType: "BUSINESS",
        companyIds: [COMPANY_A],
        defaultCompanyId: COMPANY_A,
      },
      deps,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("create failed");
    }
    expect(created.data.companyIds).toEqual([COMPANY_A]);

    const listed = await listCustomers(principal("ADMIN"), {}, deps);
    expect(listed.ok).toBe(true);

    const staffDeactivate = await setCustomerStatus(
      principal("STAFF"),
      created.data.id,
      { status: "INACTIVE" },
      deps,
    );
    expect(staffDeactivate.ok).toBe(false);
    if (!staffDeactivate.ok) {
      expect(staffDeactivate.status).toBe(403);
      expect(staffDeactivate.error).toBe(GENERIC_FORBIDDEN);
    }

    const deactivated = await setCustomerStatus(
      principal("ADMIN"),
      created.data.id,
      { status: "INACTIVE" },
      deps,
    );
    expect(deactivated.ok).toBe(true);
    if (deactivated.ok) {
      expect(deactivated.data.status).toBe("INACTIVE");
    }
  });

  it("requires accessible company link for Staff create; denies unauthorized company", async () => {
    const deps = createDeps();
    const missing = await createCustomer(
      principal("STAFF"),
      { displayName: "Solo", customerType: "INDIVIDUAL" },
      deps,
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.status).toBe(400);
      expect(missing.error).toBe(CUSTOMER_COMPANY_REQUIRED);
    }

    const foreign = await createCustomer(
      principal("STAFF"),
      {
        displayName: "Foreign Co",
        customerType: "BUSINESS",
        companyIds: [COMPANY_B],
      },
      deps,
    );
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) {
      expect(foreign.status).toBe(403);
    }
  });

  it("denies Staff access to customers without an intersecting company link", async () => {
    const deps = createDeps([
      customerRecord({
        id: "dddddddd-dddd-4ddd-8ddd-000000000002",
        companyIds: [COMPANY_B],
        defaultCompanyId: COMPANY_B,
        assignedStaffUserId: null,
      }),
    ]);
    const result = await getCustomer(
      principal("STAFF"),
      "dddddddd-dddd-4ddd-8ddd-000000000002",
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });

  it("rejects unauthorized Staff company link and audits create", async () => {
    const auditWriter = createMemoryAuditWriter();
    const deps = { ...createDeps(), auditWriter };
    const created = await createCustomer(
      principal("ADMIN"),
      {
        displayName: "Audit Co",
        customerType: "BUSINESS",
        companyIds: [COMPANY_A],
        defaultCompanyId: COMPANY_A,
      },
      deps,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("create failed");
    }
    expect(auditWriter.events[0]?.action).toBe("customers.created");

    const editInactive = await updateCustomer(
      principal("ADMIN"),
      created.data.id,
      {
        displayName: "Audit Co",
        customerType: "BUSINESS",
        companyIds: [COMPANY_A],
        defaultCompanyId: COMPANY_A,
        status: "INACTIVE",
      },
      deps,
    );
    expect(editInactive.ok).toBe(false);
    if (!editInactive.ok) {
      expect(editInactive.status).toBe(400);
    }

    const deniedLink = await linkCustomerCompany(
      principal("STAFF"),
      created.data.id,
      { companyId: COMPANY_B },
      deps,
    );
    expect(deniedLink.ok).toBe(false);
    if (!deniedLink.ok) {
      expect(deniedLink.status).toBe(403);
    }

    const linked = await setCustomerCompanies(
      principal("ADMIN"),
      created.data.id,
      { companyIds: [COMPANY_A, COMPANY_B] },
      deps,
    );
    expect(linked.ok).toBe(true);
    if (linked.ok) {
      expect([...linked.data.companyIds].sort()).toEqual([COMPANY_A, COMPANY_B].sort());
    }

    const unlinked = await unlinkCustomerCompany(
      principal("ADMIN"),
      created.data.id,
      COMPANY_B,
      deps,
    );
    expect(unlinked.ok).toBe(true);
    if (unlinked.ok) {
      expect(unlinked.data.companyIds).toEqual([COMPANY_A]);
    }
  });
});

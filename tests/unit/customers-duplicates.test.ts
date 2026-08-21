import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import type { RoleCode } from "@/domain/authz/roles";
import { CustomerDomainError } from "@/domain/customers/access";
import {
  canAcknowledgeCustomerDuplicates,
  customerAllowsNewInvoice,
  matchCustomerDuplicates,
} from "@/domain/customers/duplicates";
import {
  customerWriteSchema,
  toCustomerPersistedWriteInput,
  type CustomerPersistedWriteInput,
} from "@/domain/customers/schema";
import type { CustomerRecord } from "@/domain/customers/types";
import {
  assertCustomerActiveForNewInvoice,
  createCustomer,
  setCustomerStatus,
  updateCustomer,
  type CustomerManagementDependencies,
} from "@/server/customers/customer-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const COMPLIANCE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function principal(
  roleCode: RoleCode,
  overrides: Partial<AuthorizationPrincipal> = {},
): AuthorizationPrincipal {
  const userId =
    roleCode === "STAFF" ? STAFF_ID : roleCode === "COMPLIANCE" ? COMPLIANCE_ID : ADMIN_ID;
  return {
    userId,
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
    email: "billing@acme.example",
    phone: "+15550100",
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
    assignedStaffUserId: null,
    internalNotes: null,
    tags: [],
    companyIds: [COMPANY_A],
    createdByUserId: null,
    updatedByUserId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createDeps(seed: CustomerRecord[] = []): CustomerManagementDependencies & {
  store: { customers: CustomerRecord[] };
  auditWriter: ReturnType<typeof createMemoryAuditWriter>;
} {
  const customers = [...seed];
  const store = {
    customers,
    async listCustomers() {
      return [...customers];
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
    async setCustomerCompanies() {
      throw new Error("unused");
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
          return (
            row.displayName.trim().toLowerCase() === name ||
            (email !== null && row.email?.trim().toLowerCase() === email) ||
            (phone !== null && row.phone?.trim() === phone)
          );
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

  return { store, auditWriter: createMemoryAuditWriter() };
}

describe("customer duplicate match conditions", () => {
  it("matches email, phone, and display name case-insensitively where applicable", () => {
    const matches = matchCustomerDuplicates(
      {
        displayName: "Acme Trading",
        email: "Billing@Acme.example",
        phone: "+1 555",
      },
      [
        {
          id: "1",
          displayName: "acme trading",
          email: "other@example.com",
          phone: null,
          status: "ACTIVE",
        },
        {
          id: "2",
          displayName: "Other",
          email: "billing@acme.example",
          phone: null,
          status: "ACTIVE",
        },
        {
          id: "3",
          displayName: "Phone Twin",
          email: null,
          phone: "+1 555",
          status: "INACTIVE",
        },
        {
          id: "4",
          displayName: "Unrelated",
          email: null,
          phone: null,
          status: "ACTIVE",
        },
      ],
    );
    expect(matches.map((m) => m.customerId).sort()).toEqual(["1", "2", "3"]);
    expect(matches.find((m) => m.customerId === "1")?.matchedFields).toEqual(["displayName"]);
    expect(matches.find((m) => m.customerId === "2")?.matchedFields).toEqual(["email"]);
    expect(matches.find((m) => m.customerId === "3")?.matchedFields).toEqual(["phone"]);
  });

  it("excludes self and gates acknowledgement by role", () => {
    expect(
      matchCustomerDuplicates(
        {
          displayName: "Same",
          email: null,
          phone: null,
          excludeCustomerId: "self",
        },
        [{ id: "self", displayName: "Same", email: null, phone: null, status: "ACTIVE" }],
      ),
    ).toEqual([]);
    expect(canAcknowledgeCustomerDuplicates("ADMIN")).toBe(true);
    expect(canAcknowledgeCustomerDuplicates("COMPLIANCE")).toBe(true);
    expect(canAcknowledgeCustomerDuplicates("STAFF")).toBe(false);
    expect(customerAllowsNewInvoice("ACTIVE")).toBe(true);
    expect(customerAllowsNewInvoice("INACTIVE")).toBe(false);
  });

  it("strips acknowledgeDuplicates from persisted write input", () => {
    const parsed = customerWriteSchema.parse({
      displayName: "A",
      customerType: "BUSINESS",
      acknowledgeDuplicates: true,
    });
    expect(parsed.acknowledgeDuplicates).toBe(true);
    expect(toCustomerPersistedWriteInput(parsed)).not.toHaveProperty("acknowledgeDuplicates");
  });
});

describe("customer duplicate create/update warnings", () => {
  it("returns 409 warning without acknowledge; Admin may proceed", async () => {
    const deps = createDeps([customerRecord()]);
    const blocked = await createCustomer(
      principal("ADMIN"),
      {
        displayName: "Acme Trading",
        customerType: "BUSINESS",
        companyIds: [COMPANY_A],
        email: "other@example.com",
      },
      deps,
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.status).toBe(409);
      expect(blocked.code).toBe("CUSTOMER_DUPLICATE_WARNING");
      expect(blocked.duplicates?.[0]?.matchedFields).toContain("displayName");
    }

    const proceeded = await createCustomer(
      principal("ADMIN"),
      {
        displayName: "Acme Trading",
        customerType: "BUSINESS",
        companyIds: [COMPANY_A],
        email: "other@example.com",
        acknowledgeDuplicates: true,
      },
      deps,
    );
    expect(proceeded.ok).toBe(true);
  });

  it("allows Compliance to acknowledge and forbids Staff acknowledgement", async () => {
    const deps = createDeps([customerRecord()]);
    const staffAck = await createCustomer(
      principal("STAFF"),
      {
        displayName: "Unique Name",
        customerType: "BUSINESS",
        companyIds: [COMPANY_A],
        email: "billing@acme.example",
        acknowledgeDuplicates: true,
      },
      deps,
    );
    expect(staffAck.ok).toBe(false);
    if (!staffAck.ok) {
      expect(staffAck.status).toBe(403);
    }

    const compliance = await createCustomer(
      principal("COMPLIANCE"),
      {
        displayName: "Unique Name",
        customerType: "BUSINESS",
        companyIds: [COMPANY_A],
        email: "billing@acme.example",
        acknowledgeDuplicates: true,
      },
      deps,
    );
    expect(compliance.ok).toBe(true);
  });

  it("warns on update when identity collides with another customer", async () => {
    const deps = createDeps([
      customerRecord(),
      customerRecord({
        id: "dddddddd-dddd-4ddd-8ddd-000000000002",
        displayName: "Other Co",
        email: "other@example.com",
        phone: null,
      }),
    ]);
    const warned = await updateCustomer(
      principal("ADMIN"),
      "dddddddd-dddd-4ddd-8ddd-000000000002",
      {
        displayName: "Acme Trading",
        customerType: "BUSINESS",
        companyIds: [COMPANY_A],
      },
      deps,
    );
    expect(warned.ok).toBe(false);
    if (!warned.ok) {
      expect(warned.status).toBe(409);
    }
  });
});

describe("customer soft status and invoice gate", () => {
  it("deactivates via Admin and blocks new-invoice gate while preserving record", async () => {
    const deps = createDeps([
      customerRecord({ displayName: "Keep History", email: null, phone: null }),
    ]);
    const deactivated = await setCustomerStatus(
      principal("ADMIN"),
      "dddddddd-dddd-4ddd-8ddd-000000000001",
      { status: "INACTIVE" },
      deps,
    );
    expect(deactivated.ok).toBe(true);
    if (!deactivated.ok) {
      throw new Error("deactivate failed");
    }
    expect(deactivated.data.status).toBe("INACTIVE");
    expect(deps.auditWriter.events.some((e) => e.action === "customers.status_changed")).toBe(true);

    expect(() => assertCustomerActiveForNewInvoice(deactivated.data)).toThrow(CustomerDomainError);
    expect(() => assertCustomerActiveForNewInvoice({ status: "ACTIVE" })).not.toThrow();
  });

  it("denies Staff soft-deactivate", async () => {
    const deps = createDeps([customerRecord()]);
    const denied = await setCustomerStatus(
      principal("STAFF"),
      "dddddddd-dddd-4ddd-8ddd-000000000001",
      { status: "INACTIVE" },
      deps,
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(403);
    }
  });
});

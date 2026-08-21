import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import type { RoleCode } from "@/domain/authz/roles";
import { PROFILE_FINANCIAL_EMPTY, PROFILE_INVOICES_PLACEHOLDER } from "@/domain/customers/profile";
import type { CustomerRecord } from "@/domain/customers/types";
import {
  authorizedProfileCompanyIds,
  getCustomerProfile,
  type CustomerProfileDependencies,
} from "@/server/customers/customer-profile-service";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CUSTOMER_ID = "dddddddd-dddd-4ddd-8ddd-000000000001";

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
    id: CUSTOMER_ID,
    displayName: "Acme Trading",
    contactPerson: null,
    customerType: "BUSINESS",
    email: null,
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
    assignedStaffUserId: null,
    internalNotes: null,
    tags: [],
    companyIds: [COMPANY_A, COMPANY_B],
    createdByUserId: ADMIN_ID,
    updatedByUserId: ADMIN_ID,
    createdAt: new Date("2026-08-21T00:00:00.000Z"),
    updatedAt: new Date("2026-08-21T00:00:00.000Z"),
    ...overrides,
  };
}

function createDeps(customer: CustomerRecord): CustomerProfileDependencies {
  return {
    customerStore: {
      async getCustomerById(id: string) {
        return id === customer.id ? customer : null;
      },
    },
    companyStore: {
      async listCompaniesByIds(ids: readonly string[]) {
        return ids.map((id) => ({
          id,
          displayName: id === COMPANY_A ? "Company A" : "Company B",
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
          status: "ACTIVE" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
      },
    },
    auditStore: {
      async listByEntity() {
        return [
          {
            id: "audit-1",
            occurredAt: new Date("2026-08-21T01:00:00.000Z"),
            actorType: "USER" as const,
            actorUserId: ADMIN_ID,
            companyId: COMPANY_A,
            entityType: "customer",
            entityId: CUSTOMER_ID,
            action: "customers.created",
            oldValues: null,
            newValues: null,
            reason: null,
            ipAddress: null,
            userAgent: null,
            correlationId: "corr-1",
          },
          {
            id: "audit-2",
            occurredAt: new Date("2026-08-21T02:00:00.000Z"),
            actorType: "USER" as const,
            actorUserId: ADMIN_ID,
            companyId: COMPANY_B,
            entityType: "customer",
            entityId: CUSTOMER_ID,
            action: "customers.companies_updated",
            oldValues: null,
            newValues: null,
            reason: null,
            ipAddress: null,
            userAgent: null,
            correlationId: "corr-2",
          },
        ];
      },
    },
    noteStore: {
      async listByCustomerId() {
        return [];
      },
    },
  };
}

describe("authorizedProfileCompanyIds", () => {
  it("returns all linked companies for Admin and intersection for Staff", () => {
    expect(authorizedProfileCompanyIds(principal("ADMIN"), [COMPANY_A, COMPANY_B])).toEqual([
      COMPANY_A,
      COMPANY_B,
    ]);
    expect(authorizedProfileCompanyIds(principal("STAFF"), [COMPANY_A, COMPANY_B])).toEqual([
      COMPANY_A,
    ]);
  });
});

describe("getCustomerProfile", () => {
  it("returns identity placeholders and omits unassigned company data for Staff", async () => {
    const deps = createDeps(customerRecord());
    const result = await getCustomerProfile(principal("STAFF"), CUSTOMER_ID, {}, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.data.customer.companyIds).toEqual([COMPANY_A]);
    expect(result.data.companies.map((c) => c.id)).toEqual([COMPANY_A]);
    expect(result.data.financialSummary.status).toBe("empty");
    expect(result.data.financialSummary.message).toBe(PROFILE_FINANCIAL_EMPTY);
    expect(result.data.financialSummary.byCurrency).toEqual([]);
    expect(result.data.financialSummary.sourceAvailable).toBe(false);
    expect(result.data.invoices.message).toBe(PROFILE_INVOICES_PLACEHOLDER);
    expect(result.data.invoices.items).toEqual([]);
    expect(result.data.notes.status).toBe("ready");
    expect(result.data.notes.internalOnly).toBe(true);
    expect(result.data.notes.items).toEqual([]);
  });

  it("denies Staff filtering to an unauthorized company", async () => {
    const deps = createDeps(customerRecord());
    const result = await getCustomerProfile(
      principal("STAFF"),
      CUSTOMER_ID,
      { companyId: COMPANY_B },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(GENERIC_FORBIDDEN);
    }
  });
});

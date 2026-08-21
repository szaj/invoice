import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import type { RoleCode } from "@/domain/authz/roles";
import { canStaffEditDraftInvoice, canViewDraftInvoice } from "@/domain/invoices/access";
import type { InvoiceRecord } from "@/domain/invoices/types";
import type { CustomerRecord } from "@/domain/customers/types";
import {
  createDraftInvoice,
  updateDraftInvoice,
  type InvoiceDraftDependencies,
} from "@/server/invoices/invoice-draft-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";
import { CURRENCY_NOT_ENABLED_FOR_COMPANY } from "@/domain/currencies/types";
import { INVOICE_CUSTOMER_INACTIVE, INVOICE_DRAFT_EDIT_FORBIDDEN } from "@/domain/invoices/types";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_STAFF = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CUSTOMER_ID = "dddddddd-dddd-4ddd-8ddd-000000000001";
const INVOICE_ID = "eeeeeeee-eeee-4eee-8eee-000000000001";

function principal(
  roleCode: RoleCode,
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

function invoiceRecord(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: INVOICE_ID,
    companyId: COMPANY_A,
    customerId: CUSTOMER_ID,
    invoiceNumber: null,
    invoiceDate: new Date("2026-08-21T00:00:00.000Z"),
    dueDate: new Date("2026-09-21T00:00:00.000Z"),
    currencyCode: "USD",
    referencePo: null,
    assignedStaffUserId: STAFF_ID,
    status: "DRAFT",
    complianceStatus: "NOT_REVIEWED",
    internalNotes: null,
    customerNotes: null,
    subtotal: "0",
    discountTotal: "0",
    taxTotal: "0",
    invoiceTotal: "0",
    confirmedPaidAmount: "0",
    outstandingAmount: "0",
    cancellationReason: null,
    cancelledAt: null,
    cancelledByUserId: null,
    createdByUserId: STAFF_ID,
    updatedByUserId: STAFF_ID,
    createdAt: new Date("2026-08-21T00:00:00.000Z"),
    updatedAt: new Date("2026-08-21T00:00:00.000Z"),
    ...overrides,
  };
}

function customerRecord(overrides: Partial<CustomerRecord> = {}): CustomerRecord {
  return {
    id: CUSTOMER_ID,
    displayName: "Acme",
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
    companyIds: [COMPANY_A],
    createdByUserId: null,
    updatedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createDeps(seed: {
  invoices?: InvoiceRecord[];
  customers?: CustomerRecord[];
  currencyOk?: boolean;
}): InvoiceDraftDependencies & { auditWriter: ReturnType<typeof createMemoryAuditWriter> } {
  const invoices = [...(seed.invoices ?? [])];
  const customers = [...(seed.customers ?? [customerRecord()])];
  const currencyOk = seed.currencyOk ?? true;
  const auditWriter = createMemoryAuditWriter();

  return {
    auditWriter,
    store: {
      async listInvoices(filters) {
        return invoices.filter(
          (row) =>
            filters.companyIds.includes(row.companyId) &&
            (filters.status ? row.status === filters.status : true),
        );
      },
      async getInvoiceById(id: string) {
        return invoices.find((row) => row.id === id) ?? null;
      },
      async createInvoice(input, actor) {
        const created = invoiceRecord({
          id: "ffffffff-ffff-4fff-8fff-000000000099",
          ...input,
          createdByUserId: actor?.createdByUserId ?? null,
          updatedByUserId: actor?.createdByUserId ?? null,
        });
        invoices.push(created);
        return created;
      },
      async updateInvoice(id, input, actor) {
        const index = invoices.findIndex((row) => row.id === id);
        const updated = invoiceRecord({
          ...invoices[index],
          ...input,
          id,
          updatedByUserId: actor?.updatedByUserId ?? null,
        });
        invoices[index] = updated;
        return updated;
      },
    },
    customerStore: {
      async getCustomerById(id: string) {
        return customers.find((row) => row.id === id) ?? null;
      },
    },
    currencySelection: {
      companyCurrencyStore: {
        async companyExists() {
          return true;
        },
        async getCompanyCurrencyConfiguration(companyId: string) {
          return {
            companyId,
            companyDisplayName: "Co",
            currencies: currencyOk
              ? [
                  {
                    currencyId: "dddddddd-dddd-4ddd-8ddd-000000000002",
                    code: "USD",
                    name: "US Dollar",
                    symbol: "$",
                    decimalPrecision: 2,
                    globalStatus: "ACTIVE" as const,
                    enabled: true,
                    isDefault: true,
                  },
                ]
              : [],
            enabledCurrencyIds: currencyOk ? ["dddddddd-dddd-4ddd-8ddd-000000000002"] : [],
            defaultCurrencyId: currencyOk ? "dddddddd-dddd-4ddd-8ddd-000000000002" : null,
          };
        },
      },
      currencyStore: {
        async getCurrencyById() {
          return null;
        },
        async findByCode() {
          return null;
        },
      },
    },
  };
}

describe("invoice draft access rules", () => {
  it("allows Staff to edit own or assigned drafts only", () => {
    const own = invoiceRecord({ createdByUserId: STAFF_ID, assignedStaffUserId: null });
    const assigned = invoiceRecord({
      createdByUserId: OTHER_STAFF,
      assignedStaffUserId: STAFF_ID,
    });
    const foreign = invoiceRecord({
      createdByUserId: OTHER_STAFF,
      assignedStaffUserId: OTHER_STAFF,
    });
    expect(canStaffEditDraftInvoice(principal("STAFF"), own)).toBe(true);
    expect(canStaffEditDraftInvoice(principal("STAFF"), assigned)).toBe(true);
    expect(canStaffEditDraftInvoice(principal("STAFF"), foreign)).toBe(false);
    expect(canStaffEditDraftInvoice(principal("ADMIN"), foreign)).toBe(true);
    expect(canViewDraftInvoice(principal("STAFF"), foreign)).toBe(false);
  });
});

describe("invoice draft service authorization", () => {
  it("rejects Staff update of an unassigned draft", async () => {
    const deps = createDeps({
      invoices: [
        invoiceRecord({
          createdByUserId: OTHER_STAFF,
          assignedStaffUserId: OTHER_STAFF,
        }),
      ],
    });
    const result = await updateDraftInvoice(
      principal("STAFF"),
      INVOICE_ID,
      {
        companyId: COMPANY_A,
        customerId: CUSTOMER_ID,
        invoiceDate: "2026-08-21",
        dueDate: "2026-09-21",
        currencyCode: "USD",
      },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(INVOICE_DRAFT_EDIT_FORBIDDEN);
    }
  });

  it("rejects inactive customers and disabled currencies on create", async () => {
    const inactiveDeps = createDeps({
      customers: [customerRecord({ status: "INACTIVE" })],
    });
    const inactive = await createDraftInvoice(
      principal("ADMIN"),
      {
        companyId: COMPANY_A,
        customerId: CUSTOMER_ID,
        invoiceDate: "2026-08-21",
        dueDate: "2026-09-21",
        currencyCode: "USD",
      },
      inactiveDeps,
    );
    expect(inactive.ok).toBe(false);
    if (!inactive.ok) {
      expect(inactive.status).toBe(400);
      expect(inactive.error).toBe(INVOICE_CUSTOMER_INACTIVE);
    }

    const currencyDeps = createDeps({ currencyOk: false });
    const badCurrency = await createDraftInvoice(
      principal("ADMIN"),
      {
        companyId: COMPANY_A,
        customerId: CUSTOMER_ID,
        invoiceDate: "2026-08-21",
        dueDate: "2026-09-21",
        currencyCode: "USD",
      },
      currencyDeps,
    );
    expect(badCurrency.ok).toBe(false);
    if (!badCurrency.ok) {
      expect(badCurrency.status).toBe(400);
      expect(badCurrency.error).toBe(CURRENCY_NOT_ENABLED_FOR_COMPANY);
    }
  });

  it("creates a draft and audits for Admin", async () => {
    const deps = createDeps({});
    const created = await createDraftInvoice(
      principal("ADMIN"),
      {
        companyId: COMPANY_A,
        customerId: CUSTOMER_ID,
        invoiceDate: "2026-08-21",
        dueDate: "2026-09-21",
        currencyCode: "USD",
        referencePo: "PO-1",
      },
      deps,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("create failed");
    }
    expect(created.data.status).toBe("DRAFT");
    expect(created.data.assignedStaffUserId).toBe(ADMIN_ID);
    expect(created.data.invoiceNumber).toBeNull();
    expect(deps.auditWriter.events[0]?.action).toBe("invoices.created");
  });

  it("denies Staff create for an unassigned company", async () => {
    const deps = createDeps({
      customers: [customerRecord({ companyIds: [COMPANY_B], defaultCompanyId: COMPANY_B })],
    });
    const result = await createDraftInvoice(
      principal("STAFF"),
      {
        companyId: COMPANY_B,
        customerId: CUSTOMER_ID,
        invoiceDate: "2026-08-21",
        dueDate: "2026-09-21",
        currencyCode: "USD",
      },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });

  it("scopes draft list to an accessible company and denies unassigned company filter", async () => {
    const { listDraftInvoices } = await import("@/server/invoices/invoice-draft-service");
    const deps = createDeps({
      invoices: [
        invoiceRecord({ id: INVOICE_ID, companyId: COMPANY_A }),
        invoiceRecord({
          id: "eeeeeeee-eeee-4eee-8eee-000000000002",
          companyId: COMPANY_B,
          createdByUserId: STAFF_ID,
          assignedStaffUserId: STAFF_ID,
        }),
      ],
    });

    const allowed = await listDraftInvoices(
      principal("STAFF"),
      { companyId: COMPANY_A, status: "DRAFT" },
      deps,
    );
    expect(allowed.ok).toBe(true);
    if (allowed.ok) {
      expect(allowed.data).toHaveLength(1);
      expect(allowed.data[0]?.companyId).toBe(COMPANY_A);
    }

    const denied = await listDraftInvoices(
      principal("STAFF"),
      { companyId: COMPANY_B, status: "DRAFT" },
      deps,
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(403);
    }
  });
});

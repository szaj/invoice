import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import type { RoleCode } from "@/domain/authz/roles";
import { buildCustomerExternalDocumentPayload } from "@/domain/customers/external-document-payload";
import type { CustomerNoteRecord } from "@/domain/customers/notes";
import type { CustomerRecord } from "@/domain/customers/types";
import {
  createCustomerNote,
  listCustomerNotes,
  type CustomerNoteDependencies,
} from "@/server/customers/customer-note-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CUSTOMER_ID = "dddddddd-dddd-4ddd-8ddd-000000000010";

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
    email: "acme@example.com",
    phone: null,
    alternatePhone: null,
    addressLine1: "1 Main St",
    addressLine2: null,
    city: "Dubai",
    region: null,
    postalCode: null,
    countryCode: "AE",
    taxRegistrationId: null,
    website: null,
    defaultInvoiceCurrencyCode: null,
    defaultCompanyId: COMPANY_A,
    paymentPreference: null,
    status: "ACTIVE",
    complianceStatus: "NOT_REVIEWED",
    assignedStaffUserId: null,
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

function noteRecord(overrides: Partial<CustomerNoteRecord> = {}): CustomerNoteRecord {
  return {
    id: "eeeeeeee-eeee-4eee-8eee-000000000001",
    customerId: CUSTOMER_ID,
    authorUserId: ADMIN_ID,
    authorName: "Admin User",
    body: "Called customer about overdue invoice",
    visibility: "INTERNAL",
    createdAt: new Date("2026-08-21T03:00:00.000Z"),
    ...overrides,
  };
}

function createDeps(
  customer: CustomerRecord,
  seed: CustomerNoteRecord[] = [],
): CustomerNoteDependencies & {
  notes: CustomerNoteRecord[];
  auditWriter: ReturnType<typeof createMemoryAuditWriter>;
} {
  const notes = [...seed];
  const auditWriter = createMemoryAuditWriter();
  return {
    notes,
    customerStore: {
      async getCustomerById(id: string) {
        return id === customer.id ? customer : null;
      },
    },
    noteStore: {
      async listByCustomerId(customerId: string) {
        return notes.filter((note) => note.customerId === customerId);
      },
      async createNote(input) {
        const created = noteRecord({
          id: "eeeeeeee-eeee-4eee-8eee-000000000099",
          customerId: input.customerId,
          authorUserId: input.authorUserId,
          body: input.body,
          authorName: null,
        });
        notes.unshift(created);
        return created;
      },
    },
    auditWriter,
  };
}

describe("customer external document payload", () => {
  it("omits internal notes from PDF/email payload fixtures", () => {
    const customer = customerRecord();
    const notes = [noteRecord()];
    const payload = buildCustomerExternalDocumentPayload(customer, notes);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(notes[0]!.body);
    expect(serialized).not.toContain("note");
    expect(serialized).not.toContain("INTERNAL");
    expect(payload).toEqual({
      customerId: customer.id,
      displayName: customer.displayName,
      email: customer.email,
      billingAddress: {
        line1: customer.addressLine1,
        line2: customer.addressLine2,
        city: customer.city,
        region: customer.region,
        postalCode: customer.postalCode,
        countryCode: customer.countryCode,
      },
    });
  });
});

describe("customer notes authorization", () => {
  it("allows create/list for accessible customers and audits create", async () => {
    const deps = createDeps(customerRecord());
    const created = await createCustomerNote(
      principal("STAFF"),
      CUSTOMER_ID,
      { body: " Follow up tomorrow " },
      deps,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("create failed");
    }
    expect(created.data.body).toBe("Follow up tomorrow");
    expect(created.data.visibility).toBe("INTERNAL");
    expect(deps.auditWriter.events[0]?.action).toBe("customers.note_created");

    const listed = await listCustomerNotes(principal("STAFF"), CUSTOMER_ID, deps);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data).toHaveLength(1);
    }
  });

  it("denies Staff notes on customers outside assignment", async () => {
    const deps = createDeps(
      customerRecord({
        companyIds: [COMPANY_B],
        defaultCompanyId: COMPANY_B,
      }),
    );
    const listed = await listCustomerNotes(principal("STAFF"), CUSTOMER_ID, deps);
    expect(listed.ok).toBe(false);
    if (!listed.ok) {
      expect(listed.status).toBe(403);
      expect(listed.error).toBe(GENERIC_FORBIDDEN);
    }
  });
});

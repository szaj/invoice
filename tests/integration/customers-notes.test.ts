import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { createCustomer } from "@/server/customers/customer-service";
import { createCustomerNote, listCustomerNotes } from "@/server/customers/customer-note-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { PrismaCustomerNoteStore } from "@/server/customers/customer-note-repository";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { createCompany } from "@/server/companies/company-service";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("customer notes integration", () => {
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];

  it("supports create/list notes and denies Staff outside assignment", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const customerDeps = { store: new PrismaCustomerStore() };
    const noteDeps = {
      customerStore: new PrismaCustomerStore(),
      noteStore: new PrismaCustomerNoteStore(),
    };
    const companyDeps = { store: new PrismaCompanyStore() };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee71";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    await prisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        name: "TASK-027 Admin",
        email: `task027-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee72",
        status: "ACTIVE",
      },
      update: {},
    });

    const company = await createCompany(
      admin,
      { displayName: `Notes Co ${Date.now()}` },
      companyDeps,
    );
    expect(company.ok).toBe(true);
    if (!company.ok) {
      throw new Error("company create failed");
    }
    createdCompanyIds.push(company.data.id);

    const otherCompany = await createCompany(
      admin,
      { displayName: `Notes Other ${Date.now()}` },
      companyDeps,
    );
    expect(otherCompany.ok).toBe(true);
    if (!otherCompany.ok) {
      throw new Error("other company create failed");
    }
    createdCompanyIds.push(otherCompany.data.id);

    const marker = `task027-${Date.now()}`;
    const created = await createCustomer(
      admin,
      {
        displayName: `Notes Customer ${marker}`,
        customerType: "BUSINESS",
        companyIds: [company.data.id],
        defaultCompanyId: company.data.id,
      },
      customerDeps,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("customer create failed");
    }
    createdCustomerIds.push(created.data.id);

    const note = await createCustomerNote(
      admin,
      created.data.id,
      { body: `Internal note ${marker}` },
      noteDeps,
    );
    expect(note.ok).toBe(true);
    if (!note.ok) {
      throw new Error("note create failed");
    }
    expect(note.data.visibility).toBe("INTERNAL");
    expect(note.data.body).toContain(marker);

    const listed = await listCustomerNotes(admin, created.data.id, noteDeps);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data.some((row) => row.id === note.data.id)).toBe(true);
    }

    const staff: AuthorizationPrincipal = {
      userId: "staff-actor-027",
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [otherCompany.data.id],
    };

    const staffDenied = await listCustomerNotes(staff, created.data.id, noteDeps);
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
      expect(staffDenied.error).toBe(GENERIC_FORBIDDEN);
    }

    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    expect(tables.map((table) => table.table_name)).toContain("customer_notes");
  }, 60_000);

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdCustomerIds.length > 0) {
      await prisma.customerNote.deleteMany({
        where: { customerId: { in: createdCustomerIds } },
      });
      await prisma.customerCompany.deleteMany({
        where: { customerId: { in: createdCustomerIds } },
      });
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    }
    if (createdCompanyIds.length > 0) {
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
    await prisma.user.deleteMany({
      where: {
        id: {
          in: ["aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee71"],
        },
      },
    });
    await prisma.$disconnect();
  });
});

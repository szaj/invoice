import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import {
  createCustomer,
  getCustomer,
  linkCustomerCompany,
  listCustomers,
  setCustomerStatus,
  unlinkCustomerCompany,
  updateCustomer,
} from "@/server/customers/customer-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { createCompany } from "@/server/companies/company-service";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("customer company relationships integration", () => {
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];

  it("supports link/unlink, company filter, and Staff denied unauthorized company", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const customerDeps = { store: new PrismaCustomerStore() };
    const companyDeps = { store: new PrismaCompanyStore() };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee51";
    const adminAuthId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee52";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    // Clear leftover fixture rows (including auth-UUID collisions from other suites).
    await prisma.user.deleteMany({
      where: {
        OR: [{ id: adminId }, { supabaseAuthUserId: adminAuthId }],
      },
    });

    await prisma.user.create({
      data: {
        id: adminId,
        name: "TASK-025 Admin",
        email: `task025-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: adminAuthId,
        status: "ACTIVE",
      },
    });

    const company = await createCompany(
      admin,
      { displayName: `Cust Link Co ${Date.now()}` },
      companyDeps,
    );
    expect(company.ok).toBe(true);
    if (!company.ok) {
      throw new Error("company create failed");
    }
    createdCompanyIds.push(company.data.id);

    const otherCompany = await createCompany(
      admin,
      { displayName: `Other Link Co ${Date.now()}` },
      companyDeps,
    );
    expect(otherCompany.ok).toBe(true);
    if (!otherCompany.ok) {
      throw new Error("other company create failed");
    }
    createdCompanyIds.push(otherCompany.data.id);

    const marker = `task025-${Date.now()}`;
    const created = await createCustomer(
      admin,
      {
        displayName: `Customer ${marker}`,
        customerType: "BUSINESS",
        email: `${marker}@example.com`,
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
    expect(created.data.companyIds).toEqual([company.data.id]);

    const linked = await linkCustomerCompany(
      admin,
      created.data.id,
      { companyId: otherCompany.data.id },
      customerDeps,
    );
    expect(linked.ok).toBe(true);
    if (linked.ok) {
      expect([...linked.data.companyIds].sort()).toEqual(
        [company.data.id, otherCompany.data.id].sort(),
      );
    }

    const filtered = await listCustomers(
      admin,
      { q: marker, companyId: otherCompany.data.id },
      customerDeps,
    );
    expect(filtered.ok).toBe(true);
    if (filtered.ok) {
      expect(filtered.data.rows.some((row) => row.id === created.data.id)).toBe(true);
    }

    const unlinked = await unlinkCustomerCompany(
      admin,
      created.data.id,
      otherCompany.data.id,
      customerDeps,
    );
    expect(unlinked.ok).toBe(true);
    if (unlinked.ok) {
      expect(unlinked.data.companyIds).toEqual([company.data.id]);
    }

    const updated = await updateCustomer(
      admin,
      created.data.id,
      {
        displayName: `Customer ${marker} Updated`,
        customerType: "BUSINESS",
        email: `${marker}@example.com`,
        companyIds: [company.data.id],
        defaultCompanyId: company.data.id,
      },
      customerDeps,
    );
    expect(updated.ok).toBe(true);

    const staff: AuthorizationPrincipal = {
      userId: "staff-actor-025",
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [company.data.id],
    };

    const staffGet = await getCustomer(staff, created.data.id, customerDeps);
    expect(staffGet.ok).toBe(true);

    const staffDeniedLink = await linkCustomerCompany(
      staff,
      created.data.id,
      { companyId: otherCompany.data.id },
      customerDeps,
    );
    expect(staffDeniedLink.ok).toBe(false);
    if (!staffDeniedLink.ok) {
      expect(staffDeniedLink.status).toBe(403);
      expect(staffDeniedLink.error).toBe(GENERIC_FORBIDDEN);
    }

    const foreign = await createCustomer(
      admin,
      {
        displayName: `Foreign ${marker}`,
        customerType: "INDIVIDUAL",
        companyIds: [otherCompany.data.id],
        defaultCompanyId: otherCompany.data.id,
      },
      customerDeps,
    );
    expect(foreign.ok).toBe(true);
    if (!foreign.ok) {
      throw new Error("foreign create failed");
    }
    createdCustomerIds.push(foreign.data.id);

    const staffDenied = await getCustomer(staff, foreign.data.id, customerDeps);
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
      expect(staffDenied.error).toBe(GENERIC_FORBIDDEN);
    }

    const staffDeactivate = await setCustomerStatus(
      staff,
      created.data.id,
      { status: "INACTIVE" },
      customerDeps,
    );
    expect(staffDeactivate.ok).toBe(false);
    if (!staffDeactivate.ok) {
      expect(staffDeactivate.status).toBe(403);
    }

    const deactivated = await setCustomerStatus(
      admin,
      created.data.id,
      { status: "INACTIVE" },
      customerDeps,
    );
    expect(deactivated.ok).toBe(true);

    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const tableNames = tables.map((table) => table.table_name);
    expect(tableNames).toContain("customers");
    expect(tableNames).toContain("customer_companies");
  }, 60_000);

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdCustomerIds.length > 0) {
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
          in: ["aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee51"],
        },
      },
    });
    await prisma.$disconnect();
  });
});

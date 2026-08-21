import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { createCustomer, linkCustomerCompany } from "@/server/customers/customer-service";
import { getCustomerProfile } from "@/server/customers/customer-profile-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { createCompany } from "@/server/companies/company-service";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("customer profile integration", () => {
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];

  it("returns profile payload with placeholders and omits unassigned company data", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const customerDeps = { store: new PrismaCustomerStore() };
    const companyDeps = { store: new PrismaCompanyStore() };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee61";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    await prisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        name: "TASK-026 Admin",
        email: `task026-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee62",
        status: "ACTIVE",
      },
      update: {},
    });

    const company = await createCompany(
      admin,
      { displayName: `Profile Co ${Date.now()}` },
      companyDeps,
    );
    expect(company.ok).toBe(true);
    if (!company.ok) {
      throw new Error("company create failed");
    }
    createdCompanyIds.push(company.data.id);

    const otherCompany = await createCompany(
      admin,
      { displayName: `Profile Other ${Date.now()}` },
      companyDeps,
    );
    expect(otherCompany.ok).toBe(true);
    if (!otherCompany.ok) {
      throw new Error("other company create failed");
    }
    createdCompanyIds.push(otherCompany.data.id);

    const marker = `task026-${Date.now()}`;
    const created = await createCustomer(
      admin,
      {
        displayName: `Profile Customer ${marker}`,
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

    await linkCustomerCompany(
      admin,
      created.data.id,
      { companyId: otherCompany.data.id },
      customerDeps,
    );

    const adminProfile = await getCustomerProfile(admin, created.data.id, {});
    expect(adminProfile.ok).toBe(true);
    if (!adminProfile.ok) {
      throw new Error("admin profile failed");
    }
    expect(adminProfile.data.customer.displayName).toContain(marker);
    expect([...adminProfile.data.customer.companyIds].sort()).toEqual(
      [company.data.id, otherCompany.data.id].sort(),
    );
    expect(adminProfile.data.financialSummary.status).toBe("ready");
    expect(adminProfile.data.financialSummary.byCurrency).toEqual([]);
    expect(adminProfile.data.financialSummary.sourceAvailable).toBe(true);
    expect(adminProfile.data.invoices.items).toEqual([]);
    expect(adminProfile.data.payments.items).toEqual([]);
    expect(adminProfile.data.notes.status).toBe("ready");
    expect(adminProfile.data.notes.internalOnly).toBe(true);
    expect(adminProfile.data.notes.items).toEqual([]);
    expect(
      adminProfile.data.activity.items.some((item) => item.action === "customers.created"),
    ).toBe(true);

    const staff: AuthorizationPrincipal = {
      userId: "staff-actor-026",
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [company.data.id],
    };

    const staffProfile = await getCustomerProfile(staff, created.data.id, {});
    expect(staffProfile.ok).toBe(true);
    if (!staffProfile.ok) {
      throw new Error("staff profile failed");
    }
    expect(staffProfile.data.customer.companyIds).toEqual([company.data.id]);
    expect(staffProfile.data.companies.map((c) => c.id)).toEqual([company.data.id]);

    const staffDenied = await getCustomerProfile(staff, created.data.id, {
      companyId: otherCompany.data.id,
    });
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
      expect(staffDenied.error).toBe(GENERIC_FORBIDDEN);
    }
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
          in: ["aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee61"],
        },
      },
    });
    await prisma.$disconnect();
  });
});

import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  assertCustomerActiveForNewInvoice,
  createCustomer,
  setCustomerStatus,
} from "@/server/customers/customer-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { createCompany } from "@/server/companies/company-service";
import { CustomerDomainError } from "@/domain/customers/access";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("customer duplicate detection and status integration", () => {
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];

  it("warns on duplicates, allows Admin acknowledge, and soft-deactivates", async () => {
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
        name: "TASK-028 Admin",
        email: `task028-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee62",
        status: "ACTIVE",
      },
      update: {},
    });

    const company = await createCompany(
      admin,
      { displayName: `TASK-028 Co ${Date.now()}` },
      companyDeps,
    );
    expect(company.ok).toBe(true);
    if (!company.ok) {
      throw new Error("company create failed");
    }
    createdCompanyIds.push(company.data.id);

    const marker = Date.now();
    const first = await createCustomer(
      admin,
      {
        displayName: `Dup Name ${marker}`,
        customerType: "BUSINESS",
        email: `dup-${marker}@example.com`,
        phone: `+1555${String(marker).slice(-7)}`,
        companyIds: [company.data.id],
        defaultCompanyId: company.data.id,
      },
      customerDeps,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error("first create failed");
    }
    createdCustomerIds.push(first.data.id);

    const warned = await createCustomer(
      admin,
      {
        displayName: `Dup Name ${marker}`,
        customerType: "BUSINESS",
        companyIds: [company.data.id],
        defaultCompanyId: company.data.id,
      },
      customerDeps,
    );
    expect(warned.ok).toBe(false);
    if (!warned.ok) {
      expect(warned.status).toBe(409);
      expect(warned.code).toBe("CUSTOMER_DUPLICATE_WARNING");
      expect(warned.duplicates?.some((d) => d.customerId === first.data.id)).toBe(true);
    }

    const second = await createCustomer(
      admin,
      {
        displayName: `Dup Name ${marker}`,
        customerType: "BUSINESS",
        companyIds: [company.data.id],
        defaultCompanyId: company.data.id,
        acknowledgeDuplicates: true,
      },
      customerDeps,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) {
      throw new Error("ack create failed");
    }
    createdCustomerIds.push(second.data.id);

    const deactivated = await setCustomerStatus(
      admin,
      first.data.id,
      { status: "INACTIVE" },
      customerDeps,
    );
    expect(deactivated.ok).toBe(true);
    if (!deactivated.ok) {
      throw new Error("deactivate failed");
    }
    expect(deactivated.data.status).toBe("INACTIVE");
    expect(() => assertCustomerActiveForNewInvoice(deactivated.data)).toThrow(CustomerDomainError);

    const stillThere = await prisma.customer.findUnique({ where: { id: first.data.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.status).toBe("INACTIVE");
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
      where: { id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee61" },
    });
    await prisma.$disconnect();
  });
});

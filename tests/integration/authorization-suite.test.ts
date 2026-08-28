import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { getCompany } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { updateCompanyCurrencyConfiguration } from "@/server/companies/company-currency-service";
import { PrismaCompanyCurrencyStore } from "@/server/companies/company-currency-repository";
import { createCustomer, getCustomer } from "@/server/customers/customer-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { createDraftInvoice, getDraftInvoice } from "@/server/invoices/invoice-draft-service";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("authorization suite — cross-company leakage (TASK-093)", () => {
  const createdCompanyIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdUserIds: string[] = [];

  afterAll(async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();

    if (createdInvoiceIds.length > 0) {
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
    }
    if (createdCustomerIds.length > 0) {
      await prisma.customerCompany.deleteMany({ where: { customerId: { in: createdCustomerIds } } });
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.userCompany.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (createdCompanyIds.length > 0) {
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }

    await prisma.$disconnect();
  });

  it("denies Staff and Compliance reads outside assigned companies across core services", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const companyDeps = { store: new PrismaCompanyStore() };
    const customerDeps = { store: new PrismaCustomerStore() };
    const invoiceDeps = {
      store: new PrismaInvoiceStore(),
      customerStore: new PrismaCustomerStore(),
    };
    const currencyDeps = { store: new PrismaCompanyCurrencyStore() };

    const staffRole = await prisma.role.findUniqueOrThrow({ where: { code: "STAFF" } });
    const complianceRole = await prisma.role.findUniqueOrThrow({ where: { code: "COMPLIANCE" } });

    const admin: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee93",
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    const assignedCompany = await prisma.company.create({
      data: { displayName: `Authz Assigned ${Date.now()}`, status: "ACTIVE" },
    });
    const foreignCompany = await prisma.company.create({
      data: { displayName: `Authz Foreign ${Date.now()}`, status: "ACTIVE" },
    });
    createdCompanyIds.push(assignedCompany.id, foreignCompany.id);

    const staffUser = await prisma.user.create({
      data: {
        name: "Authz Staff",
        email: `authz-staff-${Date.now()}@example.com`,
        supabaseAuthUserId: crypto.randomUUID(),
        roleId: staffRole.id,
        status: "ACTIVE",
        companies: { create: [{ companyId: assignedCompany.id }] },
      },
    });
    const complianceUser = await prisma.user.create({
      data: {
        name: "Authz Compliance",
        email: `authz-compliance-${Date.now()}@example.com`,
        supabaseAuthUserId: crypto.randomUUID(),
        roleId: complianceRole.id,
        status: "ACTIVE",
        companies: { create: [{ companyId: assignedCompany.id }] },
      },
    });
    createdUserIds.push(staffUser.id, complianceUser.id);

    const staff: AuthorizationPrincipal = {
      userId: staffUser.id,
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [assignedCompany.id],
    };
    const compliance: AuthorizationPrincipal = {
      userId: complianceUser.id,
      status: "ACTIVE",
      roleCode: "COMPLIANCE",
      assignedCompanyIds: [assignedCompany.id],
    };

    const usd = await prisma.currency.findUniqueOrThrow({ where: { code: "USD" } });
    for (const companyId of [assignedCompany.id, foreignCompany.id]) {
      const configured = await updateCompanyCurrencyConfiguration(
        admin,
        companyId,
        {
          enabledCurrencyIds: [usd.id],
          defaultCurrencyId: usd.id,
        },
        currencyDeps,
      );
      expect(configured.ok).toBe(true);
    }

    const marker = `authz-${Date.now()}`;
    const assignedCustomer = await createCustomer(
      admin,
      {
        displayName: `Assigned Customer ${marker}`,
        customerType: "BUSINESS",
        companyIds: [assignedCompany.id],
        defaultCompanyId: assignedCompany.id,
      },
      customerDeps,
    );
    const foreignCustomer = await createCustomer(
      admin,
      {
        displayName: `Foreign Customer ${marker}`,
        customerType: "BUSINESS",
        companyIds: [foreignCompany.id],
        defaultCompanyId: foreignCompany.id,
      },
      customerDeps,
    );
    expect(assignedCustomer.ok).toBe(true);
    expect(foreignCustomer.ok).toBe(true);
    if (!assignedCustomer.ok || !foreignCustomer.ok) {
      throw new Error("customer setup failed");
    }
    createdCustomerIds.push(assignedCustomer.data.id, foreignCustomer.data.id);

    const assignedInvoice = await createDraftInvoice(
      admin,
      {
        companyId: assignedCompany.id,
        customerId: assignedCustomer.data.id,
        invoiceDate: "2026-08-28",
        dueDate: "2026-09-28",
        currencyCode: "USD",
      },
      invoiceDeps,
    );
    const foreignInvoice = await createDraftInvoice(
      admin,
      {
        companyId: foreignCompany.id,
        customerId: foreignCustomer.data.id,
        invoiceDate: "2026-08-28",
        dueDate: "2026-09-28",
        currencyCode: "USD",
      },
      invoiceDeps,
    );
    expect(assignedInvoice.ok).toBe(true);
    expect(foreignInvoice.ok).toBe(true);
    if (!assignedInvoice.ok || !foreignInvoice.ok) {
      throw new Error("invoice setup failed");
    }
    createdInvoiceIds.push(assignedInvoice.data.id, foreignInvoice.data.id);

    for (const actor of [staff, compliance] as const) {
      const allowedCompany = await getCompany(actor, assignedCompany.id, companyDeps);
      expect(allowedCompany.ok).toBe(true);

      const deniedCompany = await getCompany(actor, foreignCompany.id, companyDeps);
      expect(deniedCompany.ok).toBe(false);
      if (!deniedCompany.ok) {
        expect(deniedCompany.status).toBe(403);
        expect(deniedCompany.error).toBe(GENERIC_FORBIDDEN);
      }

      const allowedCustomer = await getCustomer(actor, assignedCustomer.data.id, customerDeps);
      expect(allowedCustomer.ok).toBe(true);

      const deniedCustomer = await getCustomer(actor, foreignCustomer.data.id, customerDeps);
      expect(deniedCustomer.ok).toBe(false);
      if (!deniedCustomer.ok) {
        expect(deniedCustomer.status).toBe(403);
        expect(deniedCustomer.error).toBe(GENERIC_FORBIDDEN);
      }

      const allowedInvoice = await getDraftInvoice(actor, assignedInvoice.data.id, invoiceDeps);
      expect(allowedInvoice.ok).toBe(true);

      const deniedInvoice = await getDraftInvoice(actor, foreignInvoice.data.id, invoiceDeps);
      expect(deniedInvoice.ok).toBe(false);
      if (!deniedInvoice.ok) {
        expect(deniedInvoice.status).toBe(403);
        expect(deniedInvoice.error).toBe(GENERIC_FORBIDDEN);
      }
    }

    const adminCompany = await getCompany(admin, foreignCompany.id, companyDeps);
    expect(adminCompany.ok).toBe(true);
    const adminCustomer = await getCustomer(admin, foreignCustomer.data.id, customerDeps);
    expect(adminCustomer.ok).toBe(true);
    const adminInvoice = await getDraftInvoice(admin, foreignInvoice.data.id, invoiceDeps);
    expect(adminInvoice.ok).toBe(true);
  }, 90_000);
});

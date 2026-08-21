import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { INVOICE_CUSTOMER_INACTIVE, INVOICE_DRAFT_EDIT_FORBIDDEN } from "@/domain/invoices/types";
import { createCompany } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { updateCompanyCurrencyConfiguration } from "@/server/companies/company-currency-service";
import { PrismaCompanyCurrencyStore } from "@/server/companies/company-currency-repository";
import { createCustomer, setCustomerStatus } from "@/server/customers/customer-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { createDraftInvoice, updateDraftInvoice } from "@/server/invoices/invoice-draft-service";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("invoice draft service integration", () => {
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];

  it("creates and updates drafts; blocks inactive customer and Staff unassigned edit", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const invoiceDeps = {
      store: new PrismaInvoiceStore(),
      customerStore: new PrismaCustomerStore(),
    };
    const companyDeps = { store: new PrismaCompanyStore() };
    const customerDeps = { store: new PrismaCustomerStore() };
    const currencyDeps = { store: new PrismaCompanyCurrencyStore() };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee71";
    const staffId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee72";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };
    const staffBase = {
      userId: staffId,
      status: "ACTIVE" as const,
      roleCode: "STAFF" as const,
    };

    await prisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        name: "TASK-031 Admin",
        email: `task031-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee73",
        status: "ACTIVE",
      },
      update: {},
    });
    await prisma.user.upsert({
      where: { id: staffId },
      create: {
        id: staffId,
        name: "TASK-031 Staff",
        email: `task031-staff-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee74",
        status: "ACTIVE",
      },
      update: {},
    });

    const company = await createCompany(
      admin,
      { displayName: `Invoice Draft Co ${Date.now()}` },
      companyDeps,
    );
    expect(company.ok).toBe(true);
    if (!company.ok) {
      throw new Error("company create failed");
    }
    createdCompanyIds.push(company.data.id);

    const staff: AuthorizationPrincipal = {
      ...staffBase,
      assignedCompanyIds: [company.data.id],
    };
    await prisma.userCompany.create({
      data: { userId: staffId, companyId: company.data.id },
    });

    const usd = await prisma.currency.findUniqueOrThrow({ where: { code: "USD" } });
    const currencies = await updateCompanyCurrencyConfiguration(
      admin,
      company.data.id,
      {
        enabledCurrencyIds: [usd.id],
        defaultCurrencyId: usd.id,
      },
      currencyDeps,
    );
    expect(currencies.ok).toBe(true);

    const marker = `task031-${Date.now()}`;
    const customer = await createCustomer(
      admin,
      {
        displayName: `Invoice Customer ${marker}`,
        customerType: "BUSINESS",
        companyIds: [company.data.id],
        defaultCompanyId: company.data.id,
      },
      customerDeps,
    );
    expect(customer.ok).toBe(true);
    if (!customer.ok) {
      throw new Error("customer create failed");
    }
    createdCustomerIds.push(customer.data.id);

    const created = await createDraftInvoice(
      admin,
      {
        companyId: company.data.id,
        customerId: customer.data.id,
        invoiceDate: "2026-08-21",
        dueDate: "2026-09-20",
        currencyCode: "USD",
        referencePo: "PO-031",
      },
      invoiceDeps,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("draft create failed");
    }
    createdInvoiceIds.push(created.data.id);
    expect(created.data.status).toBe("DRAFT");
    expect(created.data.invoiceNumber).toBeNull();
    expect(created.data.assignedStaffUserId).toBe(adminId);

    const updated = await updateDraftInvoice(
      admin,
      created.data.id,
      {
        companyId: company.data.id,
        customerId: customer.data.id,
        invoiceDate: "2026-08-22",
        dueDate: "2026-09-22",
        currencyCode: "USD",
        referencePo: "PO-031-B",
        assignedStaffUserId: staffId,
      },
      invoiceDeps,
    );
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.referencePo).toBe("PO-031-B");
      expect(updated.data.assignedStaffUserId).toBe(staffId);
    }

    const staffEdit = await updateDraftInvoice(
      staff,
      created.data.id,
      {
        companyId: company.data.id,
        customerId: customer.data.id,
        invoiceDate: "2026-08-23",
        dueDate: "2026-09-23",
        currencyCode: "USD",
      },
      invoiceDeps,
    );
    expect(staffEdit.ok).toBe(true);

    const otherDraft = await createDraftInvoice(
      admin,
      {
        companyId: company.data.id,
        customerId: customer.data.id,
        invoiceDate: "2026-08-21",
        dueDate: "2026-09-21",
        currencyCode: "USD",
        assignedStaffUserId: adminId,
      },
      invoiceDeps,
    );
    expect(otherDraft.ok).toBe(true);
    if (!otherDraft.ok) {
      throw new Error("other draft failed");
    }
    createdInvoiceIds.push(otherDraft.data.id);

    const staffDenied = await updateDraftInvoice(
      staff,
      otherDraft.data.id,
      {
        companyId: company.data.id,
        customerId: customer.data.id,
        invoiceDate: "2026-08-21",
        dueDate: "2026-09-21",
        currencyCode: "USD",
      },
      invoiceDeps,
    );
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
      expect(staffDenied.error).toBe(INVOICE_DRAFT_EDIT_FORBIDDEN);
      expect(staffDenied.error).not.toBe(GENERIC_FORBIDDEN);
    }

    const deactivated = await setCustomerStatus(
      admin,
      customer.data.id,
      { status: "INACTIVE" },
      customerDeps,
    );
    expect(deactivated.ok).toBe(true);

    const blocked = await createDraftInvoice(
      admin,
      {
        companyId: company.data.id,
        customerId: customer.data.id,
        invoiceDate: "2026-08-21",
        dueDate: "2026-09-21",
        currencyCode: "USD",
      },
      invoiceDeps,
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.status).toBe(400);
      expect(blocked.error).toBe(INVOICE_CUSTOMER_INACTIVE);
    }

    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    expect(tables.map((t) => t.table_name)).toContain("invoices");
  }, 90_000);

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdInvoiceIds.length > 0) {
      await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
    }
    if (createdCustomerIds.length > 0) {
      await prisma.customerCompany.deleteMany({
        where: { customerId: { in: createdCustomerIds } },
      });
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    }
    if (createdCompanyIds.length > 0) {
      await prisma.companyCurrency.deleteMany({
        where: { companyId: { in: createdCompanyIds } },
      });
      await prisma.userCompany.deleteMany({
        where: { companyId: { in: createdCompanyIds } },
      });
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
    await prisma.user.deleteMany({
      where: {
        id: {
          in: ["aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee71", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee72"],
        },
      },
    });
    await prisma.$disconnect();
  });
});

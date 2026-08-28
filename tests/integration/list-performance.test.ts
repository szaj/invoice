import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { LIST_MAX_PAGE_SIZE, LIST_P95_BUDGET_MS } from "@/domain/lists/pagination";
import { createCompany } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { updateCompanyCurrencyConfiguration } from "@/server/companies/company-currency-service";
import { PrismaCompanyCurrencyStore } from "@/server/companies/company-currency-repository";
import { createCustomer, listCustomers } from "@/server/customers/customer-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { createDraftInvoice, listDraftInvoices } from "@/server/invoices/invoice-draft-service";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { getInvoiceReport } from "@/server/reporting/invoice-report-service";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("list/report performance (TASK-098)", () => {
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];
  const createdUserIds: string[] = [];

  it("paginates invoice and customer lists and keeps report queries under the p95 budget", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const companyDeps = { store: new PrismaCompanyStore() };
    const customerDeps = { store: new PrismaCustomerStore() };
    const currencyDeps = { store: new PrismaCompanyCurrencyStore() };
    const invoiceDeps = {
      store: new PrismaInvoiceStore(),
      customerStore: new PrismaCustomerStore(),
    };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeef98";
    const adminAuthId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeef99";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    await prisma.user.deleteMany({
      where: { OR: [{ id: adminId }, { supabaseAuthUserId: adminAuthId }] },
    });
    await prisma.user.create({
      data: {
        id: adminId,
        name: "TASK-098 Admin",
        email: `task098-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: adminAuthId,
        status: "ACTIVE",
      },
    });
    createdUserIds.push(adminId);

    const company = await createCompany(
      admin,
      { displayName: `TASK-098 Co ${Date.now()}` },
      companyDeps,
    );
    expect(company.ok).toBe(true);
    if (!company.ok) {
      throw new Error(company.error);
    }
    createdCompanyIds.push(company.data.id);

    const currency = await updateCompanyCurrencyConfiguration(
      admin,
      company.data.id,
      { enabledCurrencyCodes: ["USD"], defaultCurrencyCode: "USD" },
      currencyDeps,
    );
    expect(currency.ok).toBe(true);

    const customer = await createCustomer(
      admin,
      {
        displayName: `TASK-098 Customer ${Date.now()}`,
        customerType: "BUSINESS",
        companyIds: [company.data.id],
        defaultCompanyId: company.data.id,
      },
      customerDeps,
    );
    expect(customer.ok).toBe(true);
    if (!customer.ok) {
      throw new Error(customer.error);
    }
    createdCustomerIds.push(customer.data.id);

    for (let index = 0; index < 5; index += 1) {
      const draft = await createDraftInvoice(
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
      expect(draft.ok).toBe(true);
      if (draft.ok) {
        createdInvoiceIds.push(draft.data.id);
      }
    }

    const started = Date.now();
    const invoicePage = await listDraftInvoices(
      admin,
      { companyId: company.data.id, status: "DRAFT", page: 1, pageSize: 2 },
      invoiceDeps,
    );
    const customerPage = await listCustomers(admin, {
      companyId: company.data.id,
      page: 1,
      pageSize: 2,
    });
    const oversized = await listDraftInvoices(
      admin,
      { companyId: company.data.id, status: "DRAFT", page: 1, pageSize: 500 },
      invoiceDeps,
    );
    const report = await getInvoiceReport(admin, {
      companyId: company.data.id,
      page: 1,
      pageSize: 50,
    });
    const elapsed = Date.now() - started;

    expect(invoicePage.ok).toBe(true);
    if (invoicePage.ok) {
      expect(invoicePage.data.rows.length).toBe(2);
      expect(invoicePage.data.totalCount).toBeGreaterThanOrEqual(5);
      expect(invoicePage.data.pageSize).toBe(2);
    }

    expect(customerPage.ok).toBe(true);
    if (customerPage.ok) {
      expect(customerPage.data.rows.length).toBeGreaterThan(0);
      expect(customerPage.data.pageSize).toBeLessThanOrEqual(LIST_MAX_PAGE_SIZE);
    }

    expect(oversized.ok).toBe(true);
    if (oversized.ok) {
      expect(oversized.data.pageSize).toBe(LIST_MAX_PAGE_SIZE);
      expect(oversized.data.rows.length).toBeLessThanOrEqual(LIST_MAX_PAGE_SIZE);
    }

    expect(report.ok).toBe(true);
    if (report.ok) {
      expect(report.data.pageSize).toBeLessThanOrEqual(100);
      expect(report.data.rows.length).toBeLessThanOrEqual(report.data.pageSize);
    }

    expect(elapsed).toBeLessThan(LIST_P95_BUDGET_MS);
  });

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdInvoiceIds.length > 0) {
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
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
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });
});

import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { updateCompanyBranding } from "@/server/companies/branding-service";
import { PrismaCompanyBrandingStore } from "@/server/companies/branding-repository";
import { createCompany } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { updateCompanyCurrencyConfiguration } from "@/server/companies/company-currency-service";
import { PrismaCompanyCurrencyStore } from "@/server/companies/company-currency-repository";
import { createCustomer } from "@/server/customers/customer-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { buildCustomerFinancialSummary } from "@/domain/customers/financial-summary";
import { cancelInvoice } from "@/server/invoices/invoice-cancel-service";
import { createDraftInvoice } from "@/server/invoices/invoice-draft-service";
import { issueInvoice } from "@/server/invoices/invoice-lifecycle-service";
import { PrismaInvoiceNumberStore } from "@/server/invoices/invoice-number-repository";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { replaceDraftInvoiceLineItems } from "@/server/invoices/invoice-line-item-service";
import { PrismaCustomerFinancialSummarySource } from "@/server/customers/prisma-customer-financial-summary-source";
import { MemoryStorageService } from "@/server/storage/memory-storage";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("invoice cancellation integration", () => {
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];

  it("cancels issued invoice with reason, preserves history, excludes from outstanding", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const companyDeps = { store: new PrismaCompanyStore() };
    const brandingDeps = {
      store: new PrismaCompanyBrandingStore(),
      storage: new MemoryStorageService(),
    };
    const currencyDeps = { store: new PrismaCompanyCurrencyStore() };
    const customerDeps = { store: new PrismaCustomerStore() };
    const invoiceDeps = {
      store: new PrismaInvoiceStore(),
      customerStore: new PrismaCustomerStore(),
    };
    const lineDeps = {
      store: new PrismaInvoiceStore(),
      currencyStore: new (
        await import("@/server/currencies/currency-repository")
      ).PrismaCurrencyStore(),
    };
    const lifecycleDeps = {
      invoices: new PrismaInvoiceStore(),
      numbers: new PrismaInvoiceNumberStore(),
      skipPdfGeneration: true,
    };
    const cancelDeps = {
      invoices: new PrismaInvoiceStore(),
      now: () => new Date("2026-08-21T15:00:00.000Z"),
    };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee38";
    const staffId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee39";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };
    const staff: AuthorizationPrincipal = {
      userId: staffId,
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [], // set after company create below via reassignment
    };

    await prisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        name: "TASK-038 Admin",
        email: `task038-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee3a",
        status: "ACTIVE",
      },
      update: {},
    });
    await prisma.user.upsert({
      where: { id: staffId },
      create: {
        id: staffId,
        name: "TASK-038 Staff",
        email: `task038-staff-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee3b",
        status: "ACTIVE",
      },
      update: {},
    });

    const company = await createCompany(
      admin,
      { displayName: `Cancel Co ${Date.now()}` },
      companyDeps,
    );
    expect(company.ok).toBe(true);
    if (!company.ok) {
      throw new Error("company create failed");
    }
    createdCompanyIds.push(company.data.id);
    const staffWithCompany: AuthorizationPrincipal = {
      ...staff,
      assignedCompanyIds: [company.data.id],
    };

    await updateCompanyBranding(
      admin,
      company.data.id,
      {
        email: null,
        phone: null,
        website: null,
        invoicePrefix: "CN-",
        termsAndConditions: null,
        emailTemplateReference: null,
      },
      brandingDeps,
    );

    const usd = await prisma.currency.findUniqueOrThrow({ where: { code: "USD" } });
    await updateCompanyCurrencyConfiguration(
      admin,
      company.data.id,
      { enabledCurrencyIds: [usd.id], defaultCurrencyId: usd.id },
      currencyDeps,
    );

    const customer = await createCustomer(
      admin,
      {
        displayName: `Cancel Customer ${Date.now()}`,
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

    const draft = await createDraftInvoice(
      admin,
      {
        companyId: company.data.id,
        customerId: customer.data.id,
        invoiceDate: "2026-08-01",
        dueDate: "2026-09-01",
        currencyCode: "USD",
      },
      invoiceDeps,
    );
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      throw new Error("draft create failed");
    }
    createdInvoiceIds.push(draft.data.id);

    await replaceDraftInvoiceLineItems(
      admin,
      draft.data.id,
      {
        lineItems: [
          {
            description: "Service",
            quantity: "1",
            unitRate: "250.00",
          },
        ],
      },
      lineDeps,
    );

    const issued = await issueInvoice(admin, draft.data.id, lifecycleDeps);
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      throw new Error(issued.error);
    }
    const invoiceNumber = issued.data.invoiceNumber;
    const invoiceTotal = issued.data.invoiceTotal;
    const outstandingBefore = issued.data.outstandingAmount;
    expect(invoiceNumber).toMatch(/^CN-\d{6}$/);

    const versionCountBefore = await prisma.invoiceVersion.count({
      where: { invoiceId: draft.data.id },
    });
    expect(versionCountBefore).toBe(1);

    const staffDenied = await cancelInvoice(
      staffWithCompany,
      draft.data.id,
      { reason: "Staff attempt" },
      cancelDeps,
    );
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
    }

    const noReason = await cancelInvoice(admin, draft.data.id, { reason: "  " }, cancelDeps);
    expect(noReason.ok).toBe(false);

    const cancelled = await cancelInvoice(
      admin,
      draft.data.id,
      { reason: "Customer cancelled order" },
      cancelDeps,
    );
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) {
      throw new Error(cancelled.error);
    }
    expect(cancelled.data.status).toBe("CANCELLED");
    expect(cancelled.data.cancellationReason).toBe("Customer cancelled order");
    expect(cancelled.data.invoiceNumber).toBe(invoiceNumber);
    expect(cancelled.data.invoiceTotal).toBe(invoiceTotal);
    expect(cancelled.data.outstandingAmount).toBe(outstandingBefore);

    const versionCountAfter = await prisma.invoiceVersion.count({
      where: { invoiceId: draft.data.id },
    });
    expect(versionCountAfter).toBe(versionCountBefore);

    const stillExists = await prisma.invoice.findUnique({ where: { id: draft.data.id } });
    expect(stillExists).not.toBeNull();
    expect(stillExists?.status).toBe("CANCELLED");

    const source = new PrismaCustomerFinancialSummarySource();
    const rows = await source.listInvoiceRowsForCustomer({
      customerId: customer.data.id,
      authorizedCompanyIds: [company.data.id],
    });
    const summary = buildCustomerFinancialSummary(rows);
    expect(summary.byCurrency).toHaveLength(0);
  }, 60_000);

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdInvoiceIds.length > 0) {
      await prisma.invoiceFile.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.invoiceVersion.deleteMany({
        where: { invoiceId: { in: createdInvoiceIds } },
      });
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
  });
});

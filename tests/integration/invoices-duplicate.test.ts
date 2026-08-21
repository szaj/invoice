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
import { createDraftInvoice } from "@/server/invoices/invoice-draft-service";
import { duplicateInvoice } from "@/server/invoices/invoice-duplicate-service";
import { issueInvoice } from "@/server/invoices/invoice-lifecycle-service";
import { replaceDraftInvoiceLineItems } from "@/server/invoices/invoice-line-item-service";
import { PrismaInvoiceNumberStore } from "@/server/invoices/invoice-number-repository";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { MemoryStorageService } from "@/server/storage/memory-storage";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("invoice duplicate integration", () => {
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];

  it("duplicates issued invoice as Draft with new id, null number, and copied lines", async () => {
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
      now: () => new Date("2026-08-21T12:00:00.000Z"),
      skipPdfGeneration: true,
    };
    const duplicateDeps = {
      invoices: new PrismaInvoiceStore(),
      draft: invoiceDeps,
      lineItems: lineDeps,
    };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee43";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    await prisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        name: "TASK-043 Admin",
        email: `task043-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee44",
        status: "ACTIVE",
      },
      update: {},
    });

    const company = await createCompany(
      admin,
      { displayName: `Duplicate Co ${Date.now()}` },
      companyDeps,
    );
    expect(company.ok).toBe(true);
    if (!company.ok) {
      throw new Error("company create failed");
    }
    createdCompanyIds.push(company.data.id);

    const branding = await updateCompanyBranding(
      admin,
      company.data.id,
      {
        email: null,
        phone: null,
        website: null,
        invoicePrefix: "DP-",
        termsAndConditions: null,
        emailTemplateReference: null,
      },
      brandingDeps,
    );
    expect(branding.ok).toBe(true);

    const usd = await prisma.currency.findUniqueOrThrow({ where: { code: "USD" } });
    const currencies = await updateCompanyCurrencyConfiguration(
      admin,
      company.data.id,
      { enabledCurrencyIds: [usd.id], defaultCurrencyId: usd.id },
      currencyDeps,
    );
    expect(currencies.ok).toBe(true);

    const customer = await createCustomer(
      admin,
      {
        displayName: `Dup Customer ${Date.now()}`,
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
        referencePo: "PO-043",
        assignedStaffUserId: adminId,
        complianceStatus: "NOT_REVIEWED",
        internalNotes: "internal-source",
        customerNotes: "customer-source",
      },
      invoiceDeps,
    );
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      throw new Error("draft create failed");
    }
    createdInvoiceIds.push(draft.data.id);

    const lines = await replaceDraftInvoiceLineItems(
      admin,
      draft.data.id,
      {
        lineItems: [
          {
            description: "Consulting",
            quantity: "2",
            unitRate: "100.00",
            taxName: "VAT",
            taxRatePercent: "10",
          },
          {
            description: "Materials",
            quantity: "1",
            unitRate: "50.00",
            taxName: null,
            taxRatePercent: null,
          },
        ],
      },
      lineDeps,
    );
    expect(lines.ok).toBe(true);
    if (!lines.ok) {
      throw new Error("line items failed");
    }

    const issued = await issueInvoice(admin, draft.data.id, lifecycleDeps);
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      throw new Error("issue failed");
    }
    expect(issued.data.invoiceNumber).toBeTruthy();
    expect(issued.data.status).toBe("ISSUED");

    const duplicated = await duplicateInvoice(admin, issued.data.id, duplicateDeps);
    expect(duplicated.ok).toBe(true);
    if (!duplicated.ok) {
      throw new Error("duplicate failed");
    }
    createdInvoiceIds.push(duplicated.data.id);

    expect(duplicated.data.id).not.toBe(issued.data.id);
    expect(duplicated.data.status).toBe("DRAFT");
    expect(duplicated.data.invoiceNumber).toBeNull();
    expect(duplicated.data.companyId).toBe(issued.data.companyId);
    expect(duplicated.data.customerId).toBe(issued.data.customerId);
    expect(duplicated.data.currencyCode).toBe("USD");
    expect(duplicated.data.referencePo).toBe("PO-043");
    expect(duplicated.data.internalNotes).toBe("internal-source");
    expect(duplicated.data.customerNotes).toBe("customer-source");
    expect(duplicated.data.complianceStatus).toBe("NOT_REVIEWED");
    expect(duplicated.data.cancellationReason).toBeNull();
    expect(duplicated.data.cancelledAt).toBeNull();
    expect(duplicated.data.confirmedPaidAmount).toMatch(/^0(\.0+)?$/);
    expect(duplicated.data.invoiceTotal).toBe(issued.data.invoiceTotal);
    expect(duplicated.data.outstandingAmount).toBe(duplicated.data.invoiceTotal);

    const store = new PrismaInvoiceStore();
    const copiedLines = await store.listLineItems(duplicated.data.id);
    expect(copiedLines).toHaveLength(2);
    expect(copiedLines[0]?.description).toBe("Consulting");
    expect(copiedLines[0]?.quantity).toBe("2");
    expect(copiedLines[1]?.description).toBe("Materials");

    const sourceVersions = await prisma.invoiceVersion.count({
      where: { invoiceId: issued.data.id },
    });
    const dupVersions = await prisma.invoiceVersion.count({
      where: { invoiceId: duplicated.data.id },
    });
    expect(sourceVersions).toBeGreaterThan(0);
    expect(dupVersions).toBe(0);

    const dupFiles = await prisma.invoiceFile.count({
      where: { invoiceId: duplicated.data.id },
    });
    expect(dupFiles).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: duplicated.data.id,
        action: "invoices.duplicated",
      },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit).toBeTruthy();
  }, 90_000);

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdInvoiceIds.length > 0) {
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.invoiceFile.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.invoiceVersion.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.emailLog.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.auditLog.deleteMany({
        where: { entityType: "INVOICE", entityId: { in: createdInvoiceIds } },
      });
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
      await prisma.userCompany.deleteMany({ where: { companyId: { in: createdCompanyIds } } });
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
  });
});

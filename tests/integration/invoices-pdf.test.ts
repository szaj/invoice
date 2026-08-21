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
import { issueInvoice } from "@/server/invoices/invoice-lifecycle-service";
import { generateInvoicePdf } from "@/server/invoices/invoice-pdf-service";
import { PrismaInvoiceFileStore } from "@/server/invoices/invoice-file-repository";
import { PrismaInvoiceNumberStore } from "@/server/invoices/invoice-number-repository";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { replaceDraftInvoiceLineItems } from "@/server/invoices/invoice-line-item-service";
import { createDefaultInvoiceVersionDependencies } from "@/server/invoices/invoice-version-service";
import { MemoryStorageService } from "@/server/storage/memory-storage";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("invoice PDF generation integration", () => {
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];
  const storage = new MemoryStorageService();

  it("generates and stores a PDF file row once per version", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const companyDeps = { store: new PrismaCompanyStore() };
    const brandingDeps = {
      store: new PrismaCompanyBrandingStore(),
      storage,
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
      versions: createDefaultInvoiceVersionDependencies(),
      skipPdfGeneration: true,
    };
    const pdfDeps = {
      invoices: new PrismaInvoiceStore(),
      versions: createDefaultInvoiceVersionDependencies().versions,
      files: new PrismaInvoiceFileStore(),
      companies: new PrismaCompanyStore(),
      branding: new PrismaCompanyBrandingStore(),
      customers: new PrismaCustomerStore(),
      storage,
    };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee39";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    await prisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        name: "TASK-039 Admin",
        email: `task039-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee3c",
        status: "ACTIVE",
      },
      update: {},
    });

    const company = await createCompany(
      admin,
      { displayName: `PDF Co ${Date.now()}` },
      companyDeps,
    );
    expect(company.ok).toBe(true);
    if (!company.ok) {
      throw new Error("company create failed");
    }
    createdCompanyIds.push(company.data.id);

    await updateCompanyBranding(
      admin,
      company.data.id,
      {
        email: "billing@pdf.test",
        phone: null,
        website: null,
        invoicePrefix: "PD-",
        termsAndConditions: "Net 30",
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
        displayName: `PDF Customer ${Date.now()}`,
        customerType: "BUSINESS",
        companyIds: [company.data.id],
        defaultCompanyId: company.data.id,
        email: "ap@pdf-customer.test",
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
        internalNotes: "DO_NOT_PRINT_INTERNAL",
        customerNotes: "Visible note",
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
            description: "Design",
            quantity: "2",
            unitRate: "50.00",
          },
        ],
      },
      lineDeps,
    );

    // Existing lifecycle/versions/cancellation tests: skip PDF to avoid storage coupling.
    // Production issue path still generates PDF unless skipPdfGeneration is set.
    const issued = await issueInvoice(admin, draft.data.id, lifecycleDeps);
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      throw new Error(issued.error);
    }

    const generated = await generateInvoicePdf(admin, draft.data.id, { pageSize: "A4" }, pdfDeps);
    expect(generated.ok).toBe(true);
    if (!generated.ok) {
      throw new Error(generated.error);
    }
    expect(generated.data.byteSize).toBeGreaterThan(500);
    expect(generated.data.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(generated.data.storageKey).toContain(`/invoices/${draft.data.id}/`);

    const stored = await storage.getObject(generated.data.storageKey);
    expect(stored).not.toBeNull();
    expect(stored?.contentType).toBe("application/pdf");
    const text = Buffer.from(stored!.body).toString("latin1");
    expect(text.startsWith("%PDF")).toBe(true);
    expect(text).not.toContain("DO_NOT_PRINT_INTERNAL");

    const again = await generateInvoicePdf(admin, draft.data.id, {}, pdfDeps);
    expect(again.ok).toBe(true);
    if (!again.ok) {
      throw new Error(again.error);
    }
    expect(again.data.reusedExisting).toBe(true);
    expect(again.data.id).toBe(generated.data.id);

    const rows = await prisma.invoiceFile.findMany({ where: { invoiceId: draft.data.id } });
    expect(rows).toHaveLength(1);
  }, 90_000);

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

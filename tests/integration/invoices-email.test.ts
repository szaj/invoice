import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { PrismaCompanyBrandingStore } from "@/server/companies/branding-repository";
import { updateCompanyBranding } from "@/server/companies/branding-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { createCompany } from "@/server/companies/company-service";
import { PrismaCompanyCurrencyStore } from "@/server/companies/company-currency-repository";
import { updateCompanyCurrencyConfiguration } from "@/server/companies/company-currency-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { createCustomer } from "@/server/customers/customer-service";
import { EmailService } from "@/server/email/email-service";
import { MemoryEmailProvider } from "@/server/email/memory-email-provider";
import { PrismaEmailLogStore } from "@/server/invoices/email-log-repository";
import { createDraftInvoice } from "@/server/invoices/invoice-draft-service";
import { sendInvoiceEmail } from "@/server/invoices/invoice-email-service";
import { PrismaInvoiceFileStore } from "@/server/invoices/invoice-file-repository";
import { issueInvoice } from "@/server/invoices/invoice-lifecycle-service";
import { replaceDraftInvoiceLineItems } from "@/server/invoices/invoice-line-item-service";
import { PrismaInvoiceNumberStore } from "@/server/invoices/invoice-number-repository";
import { generateInvoicePdf } from "@/server/invoices/invoice-pdf-service";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { createDefaultInvoiceVersionDependencies } from "@/server/invoices/invoice-version-service";
import { MemoryStorageService } from "@/server/storage/memory-storage";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("invoice email delivery integration", () => {
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];
  const storage = new MemoryStorageService();
  const memoryEmail = new MemoryEmailProvider();

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdInvoiceIds.length > 0) {
      await prisma.emailLog.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.invoiceFile.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.invoiceVersion.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
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
      await prisma.companyCurrency.deleteMany({ where: { companyId: { in: createdCompanyIds } } });
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
  });

  it("sends via EmailService and records email_logs", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const companyDeps = { store: new PrismaCompanyStore() };
    const brandingDeps = { store: new PrismaCompanyBrandingStore(), storage };
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
    const emailDeps = {
      invoices: new PrismaInvoiceStore(),
      versions: createDefaultInvoiceVersionDependencies().versions,
      files: new PrismaInvoiceFileStore(),
      customers: new PrismaCustomerStore(),
      companies: new PrismaCompanyStore(),
      branding: new PrismaCompanyBrandingStore(),
      emailLogs: new PrismaEmailLogStore(),
      storage,
      emailService: new EmailService(memoryEmail, "noreply@test.local"),
    };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee41";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    await prisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        name: "TASK-041 Admin",
        email: `task041-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee4c",
        status: "ACTIVE",
      },
      update: {},
    });

    const company = await createCompany(
      admin,
      { displayName: `Email Co ${Date.now()}` },
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
        email: "billing@email.test",
        phone: "+1 555 0141",
        invoicePrefix: "EM-",
        emailTemplateReference: "invoice-default",
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
        displayName: `Email Customer ${Date.now()}`,
        customerType: "BUSINESS",
        companyIds: [company.data.id],
        defaultCompanyId: company.data.id,
        email: `customer-${Date.now()}@example.com`,
      },
      customerDeps,
    );
    expect(customer.ok).toBe(true);
    if (!customer.ok) {
      throw new Error(
        `customer create failed: ${"error" in customer ? customer.error : "unknown"}`,
      );
    }
    createdCustomerIds.push(customer.data.id);

    const draft = await createDraftInvoice(
      admin,
      {
        companyId: company.data.id,
        customerId: customer.data.id,
        currencyCode: "USD",
        invoiceDate: "2026-08-01",
        dueDate: "2026-09-01",
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
        lineItems: [{ description: "Emailable service", quantity: "1", unitRate: "25.00" }],
      },
      lineDeps,
    );
    expect(lines.ok).toBe(true);

    const issued = await issueInvoice(admin, draft.data.id, lifecycleDeps);
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      throw new Error(`issue failed: ${issued.error}`);
    }

    const pdf = await generateInvoicePdf(admin, draft.data.id, {}, pdfDeps);
    expect(pdf.ok).toBe(true);
    if (!pdf.ok) {
      throw new Error("pdf generate failed");
    }

    const emailed = await sendInvoiceEmail(admin, draft.data.id, {}, emailDeps);
    expect(emailed.ok).toBe(true);
    if (!emailed.ok) {
      throw new Error("email send failed");
    }

    expect(memoryEmail.sent).toHaveLength(1);
    expect(memoryEmail.sent[0]?.to).toBe(customer.data.email);
    expect(memoryEmail.sent[0]?.attachments?.[0]?.contentType).toBe("application/pdf");
    expect(memoryEmail.sent[0]?.attachments?.[0]?.content.byteLength).toBeGreaterThan(0);

    const logs = await prisma.emailLog.findMany({ where: { invoiceId: draft.data.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe("SENT");
    expect(logs[0]?.recipient).toBe(customer.data.email);
    expect(logs[0]?.invoiceFileId).toBe(pdf.data.id);
    expect(logs[0]?.providerMessageId).toBeTruthy();

    const stillIssued = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.data.id } });
    expect(stillIssued.status).toBe("ISSUED");
  }, 90_000);
});

import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { updateCompanyBranding } from "@/server/companies/branding-service";
import { PrismaCompanyBrandingStore } from "@/server/companies/branding-repository";
import { createCompany } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { MemoryStorageService } from "@/server/storage/memory-storage";
import { updateCompanyCurrencyConfiguration } from "@/server/companies/company-currency-service";
import { PrismaCompanyCurrencyStore } from "@/server/companies/company-currency-repository";
import { createCustomer } from "@/server/customers/customer-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { createDraftInvoice } from "@/server/invoices/invoice-draft-service";
import { PrismaInvoiceNumberStore } from "@/server/invoices/invoice-number-repository";
import {
  allocateNextInvoiceNumber,
  assignInvoiceNumber,
} from "@/server/invoices/invoice-number-service";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("invoice numbering concurrency integration", () => {
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];

  it("does not share numbers under concurrent allocation within one company", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const companyDeps = { store: new PrismaCompanyStore() };
    const brandingDeps = {
      store: new PrismaCompanyBrandingStore(),
      storage: new MemoryStorageService(),
    };
    const numberDeps = {
      numbers: new PrismaInvoiceNumberStore(),
      invoices: new PrismaInvoiceStore(),
    };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee91";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    await prisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        name: "TASK-035 Admin",
        email: `task035-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee92",
        status: "ACTIVE",
      },
      update: {},
    });

    const company = await createCompany(
      admin,
      { displayName: `Numbering Co ${Date.now()}` },
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
        invoicePrefix: "TN-",
        termsAndConditions: null,
        emailTemplateReference: null,
      },
      brandingDeps,
    );
    expect(branding.ok).toBe(true);

    const [a, b, c] = await Promise.all([
      allocateNextInvoiceNumber(admin, company.data.id, numberDeps),
      allocateNextInvoiceNumber(admin, company.data.id, numberDeps),
      allocateNextInvoiceNumber(admin, company.data.id, numberDeps),
    ]);

    expect(a.ok && b.ok && c.ok).toBe(true);
    if (!a.ok || !b.ok || !c.ok) {
      throw new Error("allocation failed");
    }

    const numbers = [a.data.invoiceNumber, b.data.invoiceNumber, c.data.invoiceNumber];
    expect(new Set(numbers).size).toBe(3);
    expect(numbers.every((value) => value.startsWith("TN-"))).toBe(true);
  }, 30_000);

  it("keeps sequences isolated across companies and assigns to drafts", async () => {
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
    const numberDeps = {
      numbers: new PrismaInvoiceNumberStore(),
      invoices: new PrismaInvoiceStore(),
    };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee93";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    await prisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        name: "TASK-035 Admin B",
        email: `task035-admin-b-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee94",
        status: "ACTIVE",
      },
      update: {},
    });

    const companyA = await createCompany(
      admin,
      { displayName: `Seq A ${Date.now()}` },
      companyDeps,
    );
    const companyB = await createCompany(
      admin,
      { displayName: `Seq B ${Date.now()}` },
      companyDeps,
    );
    expect(companyA.ok && companyB.ok).toBe(true);
    if (!companyA.ok || !companyB.ok) {
      throw new Error("company create failed");
    }
    createdCompanyIds.push(companyA.data.id, companyB.data.id);

    await updateCompanyBranding(
      admin,
      companyA.data.id,
      {
        email: null,
        phone: null,
        website: null,
        invoicePrefix: "AA-",
        termsAndConditions: null,
        emailTemplateReference: null,
      },
      brandingDeps,
    );
    await updateCompanyBranding(
      admin,
      companyB.data.id,
      {
        email: null,
        phone: null,
        website: null,
        invoicePrefix: "BB-",
        termsAndConditions: null,
        emailTemplateReference: null,
      },
      brandingDeps,
    );

    const usd = await prisma.currency.findUniqueOrThrow({ where: { code: "USD" } });
    await updateCompanyCurrencyConfiguration(
      admin,
      companyA.data.id,
      { enabledCurrencyIds: [usd.id], defaultCurrencyId: usd.id },
      currencyDeps,
    );

    const customer = await createCustomer(
      admin,
      {
        displayName: `Number Customer ${Date.now()}`,
        customerType: "BUSINESS",
        companyIds: [companyA.data.id],
        defaultCompanyId: companyA.data.id,
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
        companyId: companyA.data.id,
        customerId: customer.data.id,
        invoiceDate: "2026-08-21",
        dueDate: "2026-09-21",
        currencyCode: "USD",
      },
      invoiceDeps,
    );
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      throw new Error("draft create failed");
    }
    createdInvoiceIds.push(draft.data.id);
    expect(draft.data.invoiceNumber).toBeNull();

    const assigned = await assignInvoiceNumber(admin, draft.data.id, numberDeps);
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) {
      throw new Error("assign failed");
    }
    expect(assigned.data.invoiceNumber).toMatch(/^AA-\d{6}$/);

    const fromB = await allocateNextInvoiceNumber(admin, companyB.data.id, numberDeps);
    expect(fromB.ok).toBe(true);
    if (!fromB.ok) {
      throw new Error("company B allocate failed");
    }
    expect(fromB.data.invoiceNumber).toMatch(/^BB-\d{6}$/);
    expect(fromB.data.invoiceNumber).not.toBe(assigned.data.invoiceNumber);

    const handEdit = await createDraftInvoice(
      admin,
      {
        companyId: companyA.data.id,
        customerId: customer.data.id,
        invoiceDate: "2026-08-21",
        dueDate: "2026-09-21",
        currencyCode: "USD",
        invoiceNumber: "AA-999999",
      },
      invoiceDeps,
    );
    expect(handEdit.ok).toBe(false);
  }, 60_000);

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
  });
});

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
import { replaceDraftInvoiceLineItems } from "@/server/invoices/invoice-line-item-service";
import { PrismaInvoiceNumberStore } from "@/server/invoices/invoice-number-repository";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import {
  listInvoiceVersions,
  updateIssuedInvoiceMetadata,
} from "@/server/invoices/invoice-version-service";
import { PrismaInvoiceVersionStore } from "@/server/invoices/invoice-version-repository";
import { MemoryStorageService } from "@/server/storage/memory-storage";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("invoice versions integration", () => {
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];

  it("creates an immutable version on issue and rejects Staff financial PATCH", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const companyDeps = { store: new PrismaCompanyStore() };
    const brandingDeps = {
      store: new PrismaCompanyBrandingStore(),
      storage: new MemoryStorageService(),
    };
    const currencyDeps = { store: new PrismaCompanyCurrencyStore() };
    const customerDeps = { store: new PrismaCustomerStore() };
    const invoiceStore = new PrismaInvoiceStore();
    const invoiceDeps = {
      store: invoiceStore,
      customerStore: new PrismaCustomerStore(),
    };
    const lineDeps = {
      store: invoiceStore,
      currencyStore: new (
        await import("@/server/currencies/currency-repository")
      ).PrismaCurrencyStore(),
    };
    const versionStore = new PrismaInvoiceVersionStore();
    const versionDeps = {
      versions: versionStore,
      invoices: invoiceStore,
    };
    const lifecycleDeps = {
      invoices: invoiceStore,
      numbers: new PrismaInvoiceNumberStore(),
      versions: versionDeps,
      skipPdfGeneration: true,
    };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeb1";
    const staffId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeb3";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    await prisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        name: "TASK-037 Admin",
        email: `task037-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeb2",
        status: "ACTIVE",
      },
      update: {},
    });
    await prisma.user.upsert({
      where: { id: staffId },
      create: {
        id: staffId,
        name: "TASK-037 Staff",
        email: `task037-staff-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeb4",
        status: "ACTIVE",
      },
      update: {},
    });

    const company = await createCompany(
      admin,
      { displayName: `Versions Co ${Date.now()}` },
      companyDeps,
    );
    expect(company.ok).toBe(true);
    if (!company.ok) {
      throw new Error("company create failed");
    }
    createdCompanyIds.push(company.data.id);

    const staff: AuthorizationPrincipal = {
      userId: staffId,
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [company.data.id],
    };
    await updateCompanyBranding(
      admin,
      company.data.id,
      {
        email: null,
        phone: null,
        website: null,
        invoicePrefix: "VR-",
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
        displayName: `Version Customer ${Date.now()}`,
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
        dueDate: "2026-08-20",
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
        lineItems: [{ description: "Consulting", quantity: "1", unitRate: "250.00" }],
      },
      lineDeps,
    );

    const issued = await issueInvoice(admin, draft.data.id, lifecycleDeps);
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      throw new Error(issued.error);
    }

    const versions = await listInvoiceVersions(admin, draft.data.id, versionDeps);
    expect(versions.ok).toBe(true);
    if (!versions.ok) {
      throw new Error(versions.error);
    }
    expect(versions.data).toHaveLength(1);
    expect(versions.data[0]?.versionNo).toBe(1);
    expect(versions.data[0]?.reason).toBe("Issued");
    expect(versions.data[0]?.snapshot.invoiceNumber).toMatch(/^VR-\d{6}$/);
    expect(versions.data[0]?.snapshot.invoiceTotal).toMatch(/^250(\.0+)?$/);
    expect(versions.data[0]?.snapshot.lineItems).toHaveLength(1);

    const staffFinancial = await updateIssuedInvoiceMetadata(
      staff,
      draft.data.id,
      { currencyCode: "AED" },
      versionDeps,
    );
    expect(staffFinancial.ok).toBe(false);
    if (!staffFinancial.ok) {
      expect(staffFinancial.status).toBe(400);
    }

    const staffMeta = await updateIssuedInvoiceMetadata(
      staff,
      draft.data.id,
      {
        referencePo: "X",
        assignedStaffUserId: null,
        complianceStatus: "NOT_REVIEWED",
        internalNotes: null,
        customerNotes: null,
      },
      versionDeps,
    );
    expect(staffMeta.ok).toBe(false);
    if (!staffMeta.ok) {
      expect(staffMeta.status).toBe(403);
    }

    const adminMeta = await updateIssuedInvoiceMetadata(
      admin,
      draft.data.id,
      {
        referencePo: "PO-37",
        assignedStaffUserId: null,
        complianceStatus: "UNDER_REVIEW",
        internalNotes: "internal",
        customerNotes: "thanks",
      },
      versionDeps,
    );
    expect(adminMeta.ok).toBe(true);
    if (adminMeta.ok) {
      expect(adminMeta.data.referencePo).toBe("PO-37");
      expect(adminMeta.data.currencyCode).toBe("USD");
    }

    // Historical snapshot unchanged after metadata edit
    const after = await listInvoiceVersions(admin, draft.data.id, versionDeps);
    expect(after.ok).toBe(true);
    if (after.ok) {
      expect(after.data).toHaveLength(1);
      expect(after.data[0]?.snapshot.referencePo).toBeNull();
    }
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

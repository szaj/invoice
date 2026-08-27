import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { REPORT_EXPORT_FORBIDDEN } from "@/domain/reporting/export/types";
import { updateCompanyBranding } from "@/server/companies/branding-service";
import { PrismaCompanyBrandingStore } from "@/server/companies/branding-repository";
import { createCompany } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { updateCompanyCurrencyConfiguration } from "@/server/companies/company-currency-service";
import { PrismaCompanyCurrencyStore } from "@/server/companies/company-currency-repository";
import { createCustomer } from "@/server/customers/customer-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { createDraftInvoice } from "@/server/invoices/invoice-draft-service";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { replaceDraftInvoiceLineItems } from "@/server/invoices/invoice-line-item-service";
import {
  createReportExport,
  downloadReportExport,
  type ReportExportServiceDependencies,
} from "@/server/reporting/report-export-service";
import { MemoryStorageService } from "@/server/storage/memory-storage";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("report export integration (TASK-090)", () => {
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdAuditIds: string[] = [];
  const createdExportIds: string[] = [];

  it("exports CSV, stores file metadata, writes reports.exported audit, and denies Staff", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const storage = new MemoryStorageService();
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

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee90";
    const adminAuthId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee91";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };
    const staff: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee92",
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [],
    };

    await prisma.user.deleteMany({
      where: {
        OR: [{ id: adminId }, { supabaseAuthUserId: adminAuthId }],
      },
    });
    await prisma.user.create({
      data: {
        id: adminId,
        name: "TASK-090 Admin",
        email: `task090-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: adminAuthId,
        status: "ACTIVE",
      },
    });
    createdUserIds.push(adminId);

    const company = await createCompany(
      admin,
      { displayName: `TASK-090 Co ${Date.now()}` },
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
        email: null,
        phone: null,
        website: null,
        invoicePrefix: "E9-",
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
        displayName: `TASK-090 Customer ${Date.now()}`,
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
        invoiceDate: "2026-08-20",
        dueDate: "2026-09-20",
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
        lineItems: [{ description: "Service", quantity: "1", unitRate: "75.00" }],
      },
      lineDeps,
    );

    const exportDeps: ReportExportServiceDependencies = { storage };

    const staffDenied = await createReportExport(
      staff,
      {
        reportType: "invoices",
        format: "csv",
        filters: { companyId: company.data.id },
      },
      exportDeps,
    );
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
      expect(staffDenied.error).toBe(REPORT_EXPORT_FORBIDDEN);
    }

    const exported = await createReportExport(
      admin,
      {
        reportType: "invoices",
        format: "csv",
        filters: { companyId: company.data.id },
      },
      exportDeps,
    );
    expect(exported.ok).toBe(true);
    if (!exported.ok) {
      throw new Error(exported.error);
    }
    expect(exported.data.status).toBe("COMPLETED");
    expect(exported.data.rowCount).toBeGreaterThanOrEqual(1);
    createdExportIds.push(exported.data.id);

    const download = await downloadReportExport(admin, exported.data.id, exportDeps);
    expect(download.ok).toBe(true);
    if (!download.ok) {
      throw new Error(download.error);
    }
    const csv = new TextDecoder().decode(download.data.bytes);
    expect(csv).toContain("invoiceId,invoiceNumber");
    expect(csv).toContain(draft.data.id);

    const audits = await prisma.auditLog.findMany({
      where: {
        action: AuditActions.REPORT_EXPORTED,
        actorUserId: adminId,
        companyId: company.data.id,
      },
      orderBy: { occurredAt: "desc" },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
    createdAuditIds.push(...audits.map((row) => row.id));
    expect(audits[0]?.entityType).toBe(AuditEntityTypes.REPORT_EXPORT);
    expect(audits[0]?.newValues).toEqual(
      expect.objectContaining({
        reportType: "invoices",
        format: "csv",
      }),
    );

    assertCompanyAccess(admin, company.data.id);
  }, 120_000);

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdExportIds.length > 0) {
      await prisma.reportExport.deleteMany({ where: { id: { in: createdExportIds } } });
    }
    if (createdAuditIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { id: { in: createdAuditIds } } });
    }
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
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });
});

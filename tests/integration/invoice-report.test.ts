import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { INVOICE_REPORT_FORBIDDEN } from "@/domain/reporting/types";
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
import { PrismaInvoiceNumberStore } from "@/server/invoices/invoice-number-repository";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { replaceDraftInvoiceLineItems } from "@/server/invoices/invoice-line-item-service";
import { recordManualPayment } from "@/server/payments/payment-service";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { getInvoiceReport } from "@/server/reporting/invoice-report-service";
import { MemoryStorageService } from "@/server/storage/memory-storage";
import { updatePaymentMethodSettlementConfiguration } from "@/server/settlement/settlement-service";
import { PrismaSettlementConfigStore } from "@/server/settlement/settlement-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("invoice report integration (TASK-078)", () => {
  const createdPaymentIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];
  const createdUserIds: string[] = [];
  let assignedUserCompany: { userId: string; companyId: string } | null = null;

  it("returns required columns, applies filters/sort/pagination, and scopes Staff", async () => {
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
    const settlementDeps = { store: new PrismaSettlementConfigStore() };
    const paymentDeps = {
      payments: new PrismaPaymentStore(),
      invoices: new PrismaInvoiceStore(),
      customers: new PrismaCustomerStore(),
      settlement: new PrismaSettlementConfigStore(),
      currencies: new (
        await import("@/server/currencies/currency-repository")
      ).PrismaCurrencyStore(),
      enforceTransactionalCompanyScope: async (
        actor: AuthorizationPrincipal,
        companyId: string,
      ) => {
        assertCompanyAccess(actor, companyId);
        return { ok: true as const, data: true as const };
      },
    };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeea0";
    const adminAuthId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeea1";
    const staffUserId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeea2";
    const staffAuthId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeea3";
    const otherStaffUserId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeea4";
    const otherStaffAuthId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeea5";
    const staffRole = await prisma.role.findUniqueOrThrow({ where: { code: "STAFF" } });

    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: { in: [adminId, staffUserId, otherStaffUserId] } },
          { supabaseAuthUserId: { in: [adminAuthId, staffAuthId, otherStaffAuthId] } },
        ],
      },
    });

    await prisma.user.create({
      data: {
        id: adminId,
        name: "TASK-078 Admin",
        email: `task078-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: adminAuthId,
        status: "ACTIVE",
      },
    });
    createdUserIds.push(adminId);

    await prisma.user.create({
      data: {
        id: staffUserId,
        name: "TASK-078 Staff",
        email: `task078-staff-${Date.now()}@example.com`,
        supabaseAuthUserId: staffAuthId,
        status: "ACTIVE",
        roleId: staffRole.id,
      },
    });
    createdUserIds.push(staffUserId);

    await prisma.user.create({
      data: {
        id: otherStaffUserId,
        name: "TASK-078 Other Staff",
        email: `task078-other-${Date.now()}@example.com`,
        supabaseAuthUserId: otherStaffAuthId,
        status: "ACTIVE",
        roleId: staffRole.id,
      },
    });
    createdUserIds.push(otherStaffUserId);

    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    const company = await createCompany(
      admin,
      { displayName: `Invoice Report Co ${Date.now()}` },
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
        invoicePrefix: "IRPT-",
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

    const settlement = await updatePaymentMethodSettlementConfiguration(
      admin,
      company.data.id,
      "MANUAL",
      { methodEnabled: true, enabledSettlementCurrencyCodes: ["USD"] },
      settlementDeps,
    );
    expect(settlement.ok).toBe(true);

    const customer = await createCustomer(
      admin,
      {
        displayName: `Invoice Report Customer ${Date.now()}`,
        customerType: "BUSINESS",
        companyIds: [company.data.id],
        defaultCompanyId: company.data.id,
        countryCode: "AE",
      },
      customerDeps,
    );
    expect(customer.ok).toBe(true);
    if (!customer.ok) {
      throw new Error("customer create failed");
    }
    createdCustomerIds.push(customer.data.id);

    const staffActor: AuthorizationPrincipal = {
      userId: staffUserId,
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [company.data.id],
    };

    await prisma.userCompany.create({
      data: { userId: staffUserId, companyId: company.data.id },
    });
    assignedUserCompany = { userId: staffUserId, companyId: company.data.id };

    const draft = await createDraftInvoice(
      staffActor,
      {
        companyId: company.data.id,
        customerId: customer.data.id,
        invoiceDate: "2026-08-01",
        dueDate: "2026-08-15",
        currencyCode: "USD",
        assignedStaffUserId: staffUserId,
      },
      invoiceDeps,
    );
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      throw new Error("draft create failed");
    }
    createdInvoiceIds.push(draft.data.id);

    await replaceDraftInvoiceLineItems(
      staffActor,
      draft.data.id,
      {
        lineItems: [{ description: "Report service", quantity: "1", unitRate: "100.00" }],
      },
      lineDeps,
    );

    const issued = await issueInvoice(staffActor, draft.data.id, lifecycleDeps);
    expect(issued.ok).toBe(true);

    const otherDraft = await createDraftInvoice(
      admin,
      {
        companyId: company.data.id,
        customerId: customer.data.id,
        invoiceDate: "2026-08-05",
        dueDate: "2026-08-20",
        currencyCode: "USD",
        assignedStaffUserId: otherStaffUserId,
      },
      invoiceDeps,
    );
    expect(otherDraft.ok).toBe(true);
    if (!otherDraft.ok) {
      throw new Error("other draft create failed");
    }
    createdInvoiceIds.push(otherDraft.data.id);

    await replaceDraftInvoiceLineItems(
      admin,
      otherDraft.data.id,
      {
        lineItems: [{ description: "Other service", quantity: "1", unitRate: "50.00" }],
      },
      lineDeps,
    );
    const otherIssued = await issueInvoice(admin, otherDraft.data.id, lifecycleDeps);
    expect(otherIssued.ok).toBe(true);

    const payment = await recordManualPayment(
      admin,
      {
        invoiceId: draft.data.id,
        invoiceAmountApplied: "40.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-10",
      },
      paymentDeps,
    );
    expect(payment.ok).toBe(true);
    if (!payment.ok) {
      throw new Error("payment create failed");
    }
    createdPaymentIds.push(payment.data.id);

    const adminReport = await getInvoiceReport(admin, {
      companyId: company.data.id,
      invoiceStatus: "PARTIALLY_PAID",
      sortBy: "invoiceDate",
      sortDir: "desc",
      page: 1,
      pageSize: 25,
    });
    expect(adminReport.ok).toBe(true);
    if (!adminReport.ok) {
      throw new Error("admin invoice report failed");
    }

    expect(adminReport.data.totalCount).toBeGreaterThanOrEqual(1);
    const row = adminReport.data.rows.find((entry) => entry.id === draft.data.id);
    expect(row).toBeTruthy();
    expect(row?.invoiceNumber).toBeTruthy();
    expect(row?.customerDisplayName).toContain("Invoice Report Customer");
    expect(row?.companyDisplayName).toContain("Invoice Report Co");
    expect(row?.invoiceDate).toBe("2026-08-01");
    expect(row?.dueDate).toBe("2026-08-15");
    expect(row?.currencyCode).toBe("USD");
    expect(row?.invoiceTotal).toBe("100");
    expect(row?.confirmedPaidAmount).toBe("40");
    expect(row?.outstandingAmount).toBe("60");
    expect(row?.status).toBe("PARTIALLY_PAID");
    expect(row?.assignedStaffUserId).toBe(staffUserId);
    expect(row?.assignedStaffName).toBe("TASK-078 Staff");

    const filteredByStaff = await getInvoiceReport(admin, {
      companyId: company.data.id,
      staffUserId,
      pageSize: 10,
    });
    expect(filteredByStaff.ok).toBe(true);
    if (filteredByStaff.ok) {
      expect(
        filteredByStaff.data.rows.every((entry) => entry.assignedStaffUserId === staffUserId),
      ).toBe(true);
      expect(filteredByStaff.data.rows.some((entry) => entry.id === draft.data.id)).toBe(true);
      expect(filteredByStaff.data.rows.some((entry) => entry.id === otherDraft.data.id)).toBe(
        false,
      );
    }

    const staffReport = await getInvoiceReport(staffActor, { companyId: company.data.id });
    expect(staffReport.ok).toBe(true);
    if (staffReport.ok) {
      expect(staffReport.data.rows.some((entry) => entry.id === draft.data.id)).toBe(true);
      // Other staff's invoice is not created-by or assigned-to this staff user.
      expect(staffReport.data.rows.some((entry) => entry.id === otherDraft.data.id)).toBe(false);
    }

    const otherCompany = await createCompany(
      admin,
      { displayName: `Other Invoice Report Co ${Date.now()}` },
      companyDeps,
    );
    expect(otherCompany.ok).toBe(true);
    if (!otherCompany.ok) {
      throw new Error("other company create failed");
    }
    createdCompanyIds.push(otherCompany.data.id);

    const denied = await getInvoiceReport(staffActor, { companyId: otherCompany.data.id });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(403);
      expect(denied.error).toBe(INVOICE_REPORT_FORBIDDEN);
    }
  }, 60_000);

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdPaymentIds.length > 0) {
      await prisma.paymentEvent.deleteMany({ where: { paymentId: { in: createdPaymentIds } } });
      await prisma.paymentAdjustment.deleteMany({
        where: { paymentId: { in: createdPaymentIds } },
      });
      await prisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdInvoiceIds.length > 0) {
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.invoiceFile.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.invoiceVersion.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
    }
    if (createdCustomerIds.length > 0) {
      await prisma.customerCompany.deleteMany({
        where: { customerId: { in: createdCustomerIds } },
      });
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    }
    if (assignedUserCompany) {
      await prisma.userCompany.deleteMany({
        where: {
          userId: assignedUserCompany.userId,
          companyId: assignedUserCompany.companyId,
        },
      });
    }
    if (createdCompanyIds.length > 0) {
      await prisma.companyCurrency.deleteMany({
        where: { companyId: { in: createdCompanyIds } },
      });
      await prisma.paymentGatewaySettlementCurrency.deleteMany({
        where: { gatewayConfig: { companyId: { in: createdCompanyIds } } },
      });
      await prisma.paymentGatewayConfig.deleteMany({
        where: { companyId: { in: createdCompanyIds } },
      });
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });
});

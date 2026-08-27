import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { DASHBOARD_FORBIDDEN } from "@/domain/reporting/types";
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
import { getDashboardKpis } from "@/server/reporting/dashboard-service";
import { MemoryStorageService } from "@/server/storage/memory-storage";
import { updatePaymentMethodSettlementConfiguration } from "@/server/settlement/settlement-service";
import { PrismaSettlementConfigStore } from "@/server/settlement/settlement-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("dashboard KPIs integration (TASK-077)", () => {
  const createdPaymentIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];
  const createdUserIds: string[] = [];
  let assignedUserCompany: { userId: string; companyId: string } | null = null;

  it("returns dashboard payload with fee-separated settlement and staff scoping", async () => {
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

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee90";
    const adminAuthId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee91";
    const staffUserId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee92";
    const staffAuthId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee93";
    const staffRole = await prisma.role.findUniqueOrThrow({ where: { code: "STAFF" } });

    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: { in: [adminId, staffUserId] } },
          { supabaseAuthUserId: { in: [adminAuthId, staffAuthId] } },
        ],
      },
    });

    await prisma.user.create({
      data: {
        id: adminId,
        name: "TASK-077 Admin",
        email: `task077-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: adminAuthId,
        status: "ACTIVE",
      },
    });
    createdUserIds.push(adminId);

    await prisma.user.create({
      data: {
        id: staffUserId,
        name: "TASK-077 Staff",
        email: `task077-staff-${Date.now()}@example.com`,
        supabaseAuthUserId: staffAuthId,
        status: "ACTIVE",
        roleId: staffRole.id,
      },
    });
    createdUserIds.push(staffUserId);

    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    const company = await createCompany(
      admin,
      { displayName: `Dashboard KPI Co ${Date.now()}` },
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
        invoicePrefix: "DKPI-",
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
        displayName: `Dashboard Customer ${Date.now()}`,
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
        lineItems: [{ description: "Dashboard service", quantity: "1", unitRate: "100.00" }],
      },
      lineDeps,
    );

    const issued = await issueInvoice(staffActor, draft.data.id, lifecycleDeps);
    expect(issued.ok).toBe(true);

    const payment = await recordManualPayment(
      admin,
      {
        invoiceId: draft.data.id,
        invoiceAmountApplied: "40.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-10",
        processorFeeAmount: "1.50",
        actualReceivedAmount: "38.50",
      },
      paymentDeps,
    );
    expect(payment.ok).toBe(true);
    if (!payment.ok) {
      throw new Error("payment create failed");
    }
    createdPaymentIds.push(payment.data.id);

    const adminKpis = await getDashboardKpis(admin, { companyId: company.data.id });
    expect(adminKpis.ok).toBe(true);
    if (!adminKpis.ok) {
      throw new Error("admin dashboard failed");
    }

    const usdBucket = adminKpis.data.invoiceCurrencies.find((b) => b.currencyCode === "USD");
    expect(usdBucket?.totalInvoiced).toBe("100");
    expect(usdBucket?.totalPaid).toBe("40");

    const settlementBucket = adminKpis.data.settlementCurrencies.find(
      (b) => b.currencyCode === "USD",
    );
    expect(settlementBucket).toBeTruthy();
    expect(settlementBucket?.convertedSettlement).toBe("40");
    expect(settlementBucket?.processorFees).toBe("1.5");
    expect(settlementBucket?.actualReceived).toBe("38.5");
    // Fees must not be deducted from converted settlement (BR-020).
    expect(settlementBucket?.convertedSettlement).not.toBe("38.5");

    const staffKpis = await getDashboardKpis(staffActor, { companyId: company.data.id });
    expect(staffKpis.ok).toBe(true);
    if (staffKpis.ok) {
      expect(staffKpis.data.invoiceCurrencies.some((b) => b.currencyCode === "USD")).toBe(true);
    }

    const otherCompany = await createCompany(
      admin,
      { displayName: `Other Dashboard Co ${Date.now()}` },
      companyDeps,
    );
    expect(otherCompany.ok).toBe(true);
    if (!otherCompany.ok) {
      throw new Error("other company create failed");
    }
    createdCompanyIds.push(otherCompany.data.id);

    const denied = await getDashboardKpis(staffActor, { companyId: otherCompany.data.id });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(403);
      expect(denied.error).toBe(DASHBOARD_FORBIDDEN);
    }
  });

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

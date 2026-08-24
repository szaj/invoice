import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { createCompany } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { updateCompanyBranding } from "@/server/companies/branding-service";
import { PrismaCompanyBrandingStore } from "@/server/companies/branding-repository";
import { updateCompanyCurrencyConfiguration } from "@/server/companies/company-currency-service";
import { PrismaCompanyCurrencyStore } from "@/server/companies/company-currency-repository";
import { createCustomer } from "@/server/customers/customer-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { createFixedConversionRate } from "@/server/fixed-rates/fixed-rate-service";
import { PrismaFixedConversionRateStore } from "@/server/fixed-rates/fixed-rate-repository";
import { createDraftInvoice } from "@/server/invoices/invoice-draft-service";
import { issueInvoice } from "@/server/invoices/invoice-lifecycle-service";
import { PrismaInvoiceNumberStore } from "@/server/invoices/invoice-number-repository";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { replaceDraftInvoiceLineItems } from "@/server/invoices/invoice-line-item-service";
import {
  confirmPayment,
  createPendingPayment,
  getPayment,
} from "@/server/payments/payment-service";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { MemoryStorageService } from "@/server/storage/memory-storage";
import { updatePaymentMethodSettlementConfiguration } from "@/server/settlement/settlement-service";
import { PrismaSettlementConfigStore } from "@/server/settlement/settlement-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("payment settlement snapshot integration", () => {
  const createdPaymentIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];
  const createdRateIds: string[] = [];

  it("stores the Admin snapshot on confirm and does not rewrite it when a later rate version exists", async () => {
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
    const rateDeps = { store: new PrismaFixedConversionRateStore() };
    const paymentDeps = {
      payments: new PrismaPaymentStore(),
      invoices: new PrismaInvoiceStore(),
      customers: new PrismaCustomerStore(),
      settlement: new PrismaSettlementConfigStore(),
      currencies: new (
        await import("@/server/currencies/currency-repository")
      ).PrismaCurrencyStore(),
    };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee48";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    await prisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        name: "TASK-046 Admin",
        email: `task046-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee49",
        status: "ACTIVE",
      },
      update: {},
    });

    const company = await createCompany(
      admin,
      { displayName: `Payment Snapshot Co ${Date.now()}` },
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
        invoicePrefix: "SN-",
        termsAndConditions: null,
        emailTemplateReference: null,
      },
      brandingDeps,
    );

    const gbp = await prisma.currency.findUniqueOrThrow({ where: { code: "GBP" } });
    const usd = await prisma.currency.findUniqueOrThrow({ where: { code: "USD" } });
    await updateCompanyCurrencyConfiguration(
      admin,
      company.data.id,
      { enabledCurrencyIds: [gbp.id, usd.id], defaultCurrencyId: gbp.id },
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

    const v1 = await createFixedConversionRate(
      admin,
      {
        fromCurrency: "GBP",
        toCurrency: "USD",
        fixedRate: "1.25",
        frequencyLabel: "YEARLY",
        validFrom: "2026-01-01T00:00:00.000Z",
        notes: `TASK-046 v1 ${Date.now()}`,
      },
      rateDeps,
    );
    expect(v1.ok).toBe(true);
    if (!v1.ok) {
      throw new Error(v1.error);
    }
    createdRateIds.push(v1.data.id);

    const customer = await createCustomer(
      admin,
      {
        displayName: `Payment Snapshot Customer ${Date.now()}`,
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
        invoiceDate: "2026-01-10",
        dueDate: "2026-01-31",
        currencyCode: "GBP",
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
            unitRate: "200.00",
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

    const january = await createPendingPayment(
      admin,
      {
        invoiceId: draft.data.id,
        methodCode: "MANUAL",
        invoiceAmountApplied: "100.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-01-15",
        processorFeeAmount: "5.00",
      },
      paymentDeps,
    );
    expect(january.ok).toBe(true);
    if (!january.ok) {
      throw new Error(january.error);
    }
    createdPaymentIds.push(january.data.id);
    expect(january.data.rateSource).toBe("ADMIN_FIXED_RATE");
    expect(january.data.fixedConversionRate).toBe("1.25");
    expect(january.data.rateVersionId).toBe(v1.data.id);
    expect(january.data.rateEffectiveAt?.toISOString()).toBe(v1.data.validFrom.toISOString());
    expect(january.data.convertedSettlementAmount).toBe("125");
    expect(january.data.processorFeeAmount).toBe("5");
    expect(january.data.convertedSettlementAmount).not.toBe("120");

    const confirmedJanuary = await confirmPayment(admin, january.data.id, paymentDeps);
    expect(confirmedJanuary.ok).toBe(true);
    if (!confirmedJanuary.ok) {
      throw new Error(confirmedJanuary.error);
    }
    expect(confirmedJanuary.data.status).toBe("SUCCESSFUL");
    expect(confirmedJanuary.data.fixedConversionRate).toBe("1.25");
    expect(confirmedJanuary.data.rateVersionId).toBe(v1.data.id);
    expect(confirmedJanuary.data.rateEffectiveAt?.toISOString()).toBe(
      v1.data.validFrom.toISOString(),
    );
    expect(confirmedJanuary.data.convertedSettlementAmount).toBe("125");
    expect(confirmedJanuary.data.processorFeeAmount).toBe("5");

    const v2 = await createFixedConversionRate(
      admin,
      {
        fromCurrency: "GBP",
        toCurrency: "USD",
        fixedRate: "1.26",
        frequencyLabel: "MONTHLY",
        validFrom: "2026-07-01T00:00:00.000Z",
        notes: `TASK-046 v2 ${Date.now()}`,
      },
      rateDeps,
    );
    expect(v2.ok).toBe(true);
    if (!v2.ok) {
      throw new Error(v2.error);
    }
    createdRateIds.push(v2.data.id);

    const historical = await getPayment(admin, january.data.id, paymentDeps);
    expect(historical.ok).toBe(true);
    if (!historical.ok) {
      throw new Error(historical.error);
    }
    expect(historical.data.fixedConversionRate).toBe("1.25");
    expect(historical.data.rateVersionId).toBe(v1.data.id);
    expect(historical.data.rateEffectiveAt?.toISOString()).toBe(v1.data.validFrom.toISOString());
    expect(historical.data.convertedSettlementAmount).toBe("125");

    const july = await createPendingPayment(
      admin,
      {
        invoiceId: draft.data.id,
        methodCode: "MANUAL",
        invoiceAmountApplied: "100.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-07-15",
      },
      paymentDeps,
    );
    expect(july.ok).toBe(true);
    if (!july.ok) {
      throw new Error(july.error);
    }
    createdPaymentIds.push(july.data.id);
    expect(july.data.fixedConversionRate).toBe("1.26");
    expect(july.data.rateVersionId).toBe(v2.data.id);
    expect(july.data.rateEffectiveAt?.toISOString()).toBe(v2.data.validFrom.toISOString());
    expect(july.data.convertedSettlementAmount).toBe("126");

    const confirmedJuly = await confirmPayment(admin, july.data.id, paymentDeps);
    expect(confirmedJuly.ok).toBe(true);
    if (!confirmedJuly.ok) {
      throw new Error(confirmedJuly.error);
    }
    expect(confirmedJuly.data.fixedConversionRate).toBe("1.26");
    expect(historical.data.fixedConversionRate).toBe("1.25");
  }, 60_000);

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdPaymentIds.length > 0) {
      await prisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
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
      await prisma.paymentGatewaySettlementCurrency.deleteMany({
        where: { gatewayConfig: { companyId: { in: createdCompanyIds } } },
      });
      await prisma.paymentGatewayConfig.deleteMany({
        where: { companyId: { in: createdCompanyIds } },
      });
      await prisma.companyCurrency.deleteMany({
        where: { companyId: { in: createdCompanyIds } },
      });
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
    if (createdRateIds.length > 0) {
      await prisma.fixedConversionRate.deleteMany({ where: { id: { in: createdRateIds } } });
    }
  });
});

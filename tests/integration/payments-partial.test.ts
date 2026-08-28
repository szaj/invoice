import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { PAYMENT_EXCEEDS_OPEN_BALANCE } from "@/domain/payments/types";
import { updateCompanyBranding } from "@/server/companies/branding-service";
import { PrismaCompanyBrandingStore } from "@/server/companies/branding-repository";
import { createCompany } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
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
import { listPayments, recordManualPayment } from "@/server/payments/payment-service";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { MemoryStorageService } from "@/server/storage/memory-storage";
import { updatePaymentMethodSettlementConfiguration } from "@/server/settlement/settlement-service";
import { PrismaSettlementConfigStore } from "@/server/settlement/settlement-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("partial payments + allocation (TASK-059 / TASK-060)", () => {
  const createdPaymentIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];
  const createdRateIds: string[] = [];

  afterAll(async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdPaymentIds.length > 0) {
      await prisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdInvoiceIds.length > 0) {
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
    if (createdRateIds.length > 0) {
      await prisma.fixedConversionRate.deleteMany({ where: { id: { in: createdRateIds } } });
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
  });

  it("records partial then completing payments; E2E-03/E2E-04 (GBP→USD snapshot, Partially Paid then Paid)", async () => {
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
      enforceTransactionalCompanyScope: async (
        actor: AuthorizationPrincipal,
        companyId: string,
      ) => {
        assertCompanyAccess(actor, companyId);
        return { ok: true as const, data: true as const };
      },
    };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee59";
    const adminAuthId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee5a";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };

    await prisma.user.deleteMany({
      where: { OR: [{ id: adminId }, { supabaseAuthUserId: adminAuthId }] },
    });
    await prisma.user.create({
      data: {
        id: adminId,
        name: "TASK-059 Admin",
        email: `task059-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: adminAuthId,
        status: "ACTIVE",
      },
    });

    const company = await createCompany(
      admin,
      { displayName: `Partial Pay Co ${Date.now()}` },
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
        invoicePrefix: "P9-",
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

    const rate = await createFixedConversionRate(
      admin,
      {
        fromCurrency: "GBP",
        toCurrency: "USD",
        fixedRate: "1.250000000000",
        frequencyLabel: "YEARLY",
        validFrom: "2026-01-01T00:00:00.000Z",
        notes: `TASK-059 E2E-03 precursor ${Date.now()}`,
      },
      rateDeps,
    );
    expect(rate.ok).toBe(true);
    if (!rate.ok) {
      throw new Error(rate.error);
    }
    createdRateIds.push(rate.data.id);

    const customer = await createCustomer(
      admin,
      {
        displayName: `Partial Customer ${Date.now()}`,
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
        dueDate: "2026-08-31",
        currencyCode: "GBP",
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
            description: "Partial service",
            quantity: "1",
            unitRate: "100.00",
          },
        ],
      },
      lineDeps,
    );
    expect(lines.ok).toBe(true);

    const issued = await issueInvoice(admin, draft.data.id, lifecycleDeps);
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      throw new Error(issued.error);
    }

    const first = await recordManualPayment(
      admin,
      {
        invoiceId: draft.data.id,
        invoiceAmountApplied: "40.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
        processorFeeAmount: "1.50",
      },
      paymentDeps,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error(first.error);
    }
    createdPaymentIds.push(first.data.id);
    expect(first.data.status).toBe("SUCCESSFUL");
    expect(first.data.invoiceAmountApplied).toBe("40");
    expect(first.data.fixedConversionRate).toBe("1.25");
    expect(first.data.convertedSettlementAmount).toBe("50");
    expect(first.data.processorFeeAmount).toBe("1.5");
    // Fee must not change converted settlement (BR-020 / E2E-03).
    expect(first.data.convertedSettlementAmount).not.toBe("48.5");

    const afterPartial = await new PrismaInvoiceStore().getInvoiceById(draft.data.id);
    expect(afterPartial?.status).toBe("PARTIALLY_PAID");
    expect(afterPartial?.confirmedPaidAmount).toBe("40");
    expect(afterPartial?.outstandingAmount).toBe("60");

    const second = await recordManualPayment(
      admin,
      {
        invoiceId: draft.data.id,
        invoiceAmountApplied: "60.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-25",
      },
      paymentDeps,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) {
      throw new Error(second.error);
    }
    createdPaymentIds.push(second.data.id);
    expect(second.data.status).toBe("SUCCESSFUL");
    expect(second.data.invoiceAmountApplied).toBe("60");
    expect(second.data.convertedSettlementAmount).toBe("75");

    const listed = await listPayments(
      admin,
      { companyId: company.data.id, invoiceId: draft.data.id },
      paymentDeps,
    );
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data.rows.filter((row) => row.status === "SUCCESSFUL")).toHaveLength(2);
    }

    const over = await recordManualPayment(
      admin,
      {
        invoiceId: draft.data.id,
        invoiceAmountApplied: "0.01",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-26",
      },
      paymentDeps,
    );
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.error).toBe(PAYMENT_EXCEEDS_OPEN_BALANCE);
    }

    const invoiceAfter = await new PrismaInvoiceStore().getInvoiceById(draft.data.id);
    expect(invoiceAfter?.confirmedPaidAmount).toBe("100");
    expect(invoiceAfter?.outstandingAmount).toBe("0");
    expect(invoiceAfter?.status).toBe("PAID");
  }, 120_000);
});

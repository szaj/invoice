import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuditActions } from "@/domain/audit/types";
import { PAYMENT_EXCEEDS_OPEN_BALANCE, PAYMENT_RECORD_FORBIDDEN } from "@/domain/payments/types";
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
import { recordManualPayment } from "@/server/payments/payment-service";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { MemoryStorageService } from "@/server/storage/memory-storage";
import { updatePaymentMethodSettlementConfiguration } from "@/server/settlement/settlement-service";
import { PrismaSettlementConfigStore } from "@/server/settlement/settlement-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("manual payment recording integration (TASK-050)", () => {
  const createdPaymentIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];
  const createdRateIds: string[] = [];

  it("records SUCCESSFUL manual payment, locks Admin rate snapshot, Staff denied", async () => {
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

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee5a";
    const adminAuthId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee5c";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };
    const staff: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee5b",
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [],
    };

    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: adminId },
          { supabaseAuthUserId: adminAuthId },
          // Legacy colliding fixtures from earlier TASK-050 draft IDs.
          { id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee50" },
          { supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee52" },
        ],
      },
    });

    await prisma.user.create({
      data: {
        id: adminId,
        name: "TASK-050 Admin",
        email: `task050-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: adminAuthId,
        status: "ACTIVE",
      },
    });

    const company = await createCompany(
      admin,
      { displayName: `Manual Pay Co ${Date.now()}` },
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
        invoicePrefix: "MP-",
        termsAndConditions: null,
        emailTemplateReference: null,
      },
      brandingDeps,
    );

    const aud = await prisma.currency.findUniqueOrThrow({ where: { code: "AUD" } });
    const aed = await prisma.currency.findUniqueOrThrow({ where: { code: "AED" } });
    await updateCompanyCurrencyConfiguration(
      admin,
      company.data.id,
      { enabledCurrencyIds: [aud.id, aed.id], defaultCurrencyId: aud.id },
      currencyDeps,
    );

    const settlement = await updatePaymentMethodSettlementConfiguration(
      admin,
      company.data.id,
      "MANUAL",
      { methodEnabled: true, enabledSettlementCurrencyCodes: ["USD", "AED"] },
      settlementDeps,
    );
    expect(settlement.ok).toBe(true);

    const rate = await createFixedConversionRate(
      admin,
      {
        fromCurrency: "AUD",
        toCurrency: "AED",
        fixedRate: "2.45",
        frequencyLabel: "YEARLY",
        validFrom: "2026-01-01T00:00:00.000Z",
        notes: `TASK-050 rate ${Date.now()}`,
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
        displayName: `Manual Pay Cust ${Date.now()}`,
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
        currencyCode: "AUD",
        invoiceDate: "2026-08-01",
        dueDate: "2026-08-31",
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
            description: "Service",
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
      throw new Error("issue failed");
    }

    const invoiceBefore = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.data.id } });
    const outstandingBefore = invoiceBefore.outstandingAmount.toString();
    const paidBefore = invoiceBefore.confirmedPaidAmount.toString();

    const staffDenied = await recordManualPayment(
      staff,
      {
        invoiceId: draft.data.id,
        invoiceAmountApplied: "40.00",
        settlementCurrencyCode: "AED",
        paymentDate: "2026-08-24",
      },
      paymentDeps,
    );
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
      expect(staffDenied.error).toBe(PAYMENT_RECORD_FORBIDDEN);
    }

    const recorded = await recordManualPayment(
      admin,
      {
        invoiceId: draft.data.id,
        invoiceAmountApplied: "40.00",
        settlementCurrencyCode: "AED",
        paymentDate: "2026-08-24",
        externalTransactionId: "manual-ref-e2e05",
        processorFeeAmount: "1.25",
        actualReceivedAmount: "96.00",
        notes: "E2E-05 precursor",
      },
      paymentDeps,
    );
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) {
      throw new Error(recorded.error);
    }
    createdPaymentIds.push(recorded.data.id);

    expect(recorded.data.status).toBe("SUCCESSFUL");
    expect(recorded.data.methodCode).toBe("MANUAL");
    expect(recorded.data.source).toBe("MANUAL");
    expect(recorded.data.invoiceCurrencyCode).toBe("AUD");
    expect(recorded.data.settlementCurrencyCode).toBe("AED");
    expect(recorded.data.fixedConversionRate).toBe("2.45");
    expect(recorded.data.rateSource).toBe("ADMIN_FIXED_RATE");
    expect(recorded.data.rateVersionId).toBe(rate.data.id);
    expect(recorded.data.convertedSettlementAmount).toBe("98");
    expect(recorded.data.processorFeeAmount).toBe("1.25");
    expect(recorded.data.actualReceivedAmount).toBe("96");
    expect(recorded.data.convertedSettlementAmount).not.toBe("96.75");
    expect(recorded.data.externalTransactionId).toBe("manual-ref-e2e05");

    const invoiceAfter = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.data.id } });
    expect(invoiceAfter.outstandingAmount.toString()).toBe(outstandingBefore);
    expect(invoiceAfter.confirmedPaidAmount.toString()).toBe(paidBefore);

    const overpay = await recordManualPayment(
      admin,
      {
        invoiceId: draft.data.id,
        invoiceAmountApplied: "70.00",
        settlementCurrencyCode: "AED",
        paymentDate: "2026-08-24",
      },
      paymentDeps,
    );
    expect(overpay.ok).toBe(false);
    if (!overpay.ok) {
      expect(overpay.status).toBe(400);
      expect(overpay.error).toBe(PAYMENT_EXCEEDS_OPEN_BALANCE);
    }

    const events = await prisma.auditLog.findMany({
      where: {
        entityType: "payment",
        entityId: recorded.data.id,
      },
      orderBy: { occurredAt: "asc" },
    });
    expect(events.map((event) => event.action)).toEqual([
      AuditActions.PAYMENT_CREATED,
      AuditActions.PAYMENT_CONFIRMED,
    ]);
  }, 90_000);

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
    // Remove fixture users last so leftover auth IDs cannot collide with customers-crud (…ee51/…ee52).
    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee5a" },
          { supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee5c" },
          { id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee50" },
          { supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee52" },
        ],
      },
    });
  });
});

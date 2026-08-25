import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuditActions } from "@/domain/audit/types";
import { computeCbrf, computeInvoiceOutstanding } from "@/domain/money";
import { confirmedInvoiceApplicationsFromPayments } from "@/domain/payments/reconciliation";
import { PAYMENT_ADJUST_FORBIDDEN } from "@/domain/disputes/types";
import { updateCompanyBranding } from "@/server/companies/branding-service";
import { PrismaCompanyBrandingStore } from "@/server/companies/branding-repository";
import { createCompany } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { updateCompanyCurrencyConfiguration } from "@/server/companies/company-currency-service";
import { PrismaCompanyCurrencyStore } from "@/server/companies/company-currency-repository";
import { createCustomer } from "@/server/customers/customer-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { openPaymentDispute } from "@/server/disputes/dispute-service";
import { createDraftInvoice } from "@/server/invoices/invoice-draft-service";
import { issueInvoice } from "@/server/invoices/invoice-lifecycle-service";
import { PrismaInvoiceNumberStore } from "@/server/invoices/invoice-number-repository";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { replaceDraftInvoiceLineItems } from "@/server/invoices/invoice-line-item-service";
import { PrismaPaymentAdjustmentStore } from "@/server/payments/payment-adjustment-repository";
import { recordManualPayment } from "@/server/payments/payment-service";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { MemoryStorageService } from "@/server/storage/memory-storage";
import { updatePaymentMethodSettlementConfiguration } from "@/server/settlement/settlement-service";
import { PrismaSettlementConfigStore } from "@/server/settlement/settlement-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("dispute open workflow integration (TASK-063)", () => {
  const createdAdjustmentIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];

  it("creates a payment_adjustment row without changing outstanding, CB/RF, or original payment (E2E-14)", async () => {
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
    const disputeDeps = {
      payments: new PrismaPaymentStore(),
      invoices: new PrismaInvoiceStore(),
      adjustments: new PrismaPaymentAdjustmentStore(),
      enforceTransactionalCompanyScope: paymentDeps.enforceTransactionalCompanyScope,
    };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee63";
    const adminAuthId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee64";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };
    const staff: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee65",
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
        name: "TASK-063 Admin",
        email: `task063-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: adminAuthId,
        status: "ACTIVE",
      },
    });

    const company = await createCompany(
      admin,
      { displayName: `Dispute Open Co ${Date.now()}` },
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
        invoicePrefix: "DS-",
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
        displayName: `Dispute Customer ${Date.now()}`,
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
        lineItems: [{ description: "Service", quantity: "1", unitRate: "80.00" }],
      },
      lineDeps,
    );

    const issued = await issueInvoice(admin, draft.data.id, lifecycleDeps);
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      throw new Error(issued.error);
    }

    const recorded = await recordManualPayment(
      admin,
      {
        invoiceId: draft.data.id,
        invoiceAmountApplied: "80.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
      },
      paymentDeps,
    );
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) {
      throw new Error(recorded.error);
    }
    createdPaymentIds.push(recorded.data.id);

    const invoiceBefore = await new PrismaInvoiceStore().getInvoiceById(draft.data.id);
    expect(invoiceBefore?.outstandingAmount).toBe("0");
    const paymentBefore = recorded.data;

    const staffDenied = await openPaymentDispute(staff, paymentBefore.id, {}, disputeDeps);
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
      expect(staffDenied.error).toBe(PAYMENT_ADJUST_FORBIDDEN);
    }

    const opened = await openPaymentDispute(
      admin,
      paymentBefore.id,
      { reason: "Cardholder dispute", merchantReference: "CASE-063" },
      disputeDeps,
    );
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      throw new Error(opened.error);
    }
    createdAdjustmentIds.push(opened.data.adjustment.id);

    expect(opened.data.lifecycle).toBe("DISPUTED");
    expect(opened.data.adjustment.type).toBe("DISPUTE");
    expect(opened.data.adjustment.status).toBe("OPEN");
    expect(opened.data.payment.status).toBe("SUCCESSFUL");
    expect(opened.data.payment.invoiceAmountApplied).toBe(paymentBefore.invoiceAmountApplied);
    expect(opened.data.payment.convertedSettlementAmount).toBe(
      paymentBefore.convertedSettlementAmount,
    );

    const persisted = await prisma.paymentAdjustment.findUniqueOrThrow({
      where: { id: opened.data.adjustment.id },
    });
    expect(persisted.paymentId).toBe(paymentBefore.id);
    expect(persisted.type).toBe("DISPUTE");
    expect(persisted.status).toBe("OPEN");
    expect(persisted.amount.toString()).toBe("80");

    const paymentAfter = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentBefore.id },
    });
    expect(paymentAfter.status).toBe("SUCCESSFUL");
    expect(paymentAfter.invoiceAmountApplied.toString()).toBe(paymentBefore.invoiceAmountApplied);
    expect(paymentAfter.convertedSettlementAmount.toString()).toBe(
      paymentBefore.convertedSettlementAmount,
    );

    const invoiceAfter = await new PrismaInvoiceStore().getInvoiceById(draft.data.id);
    expect(invoiceAfter?.outstandingAmount).toBe(invoiceBefore?.outstandingAmount);
    expect(invoiceAfter?.confirmedPaidAmount).toBe(invoiceBefore?.confirmedPaidAmount);

    const listedPayments = await new PrismaPaymentStore().listPayments({
      companyIds: [company.data.id],
      invoiceId: draft.data.id,
    });
    const outstanding = computeInvoiceOutstanding({
      invoiceTotal: invoiceAfter?.invoiceTotal ?? "80",
      invoiceCurrencyCode: "USD",
      confirmedApplications: confirmedInvoiceApplicationsFromPayments(listedPayments),
      decimalPrecision: 2,
    });
    expect(outstanding.amount).toBe("0");
    expect(
      computeCbrf({
        adjustments: [opened.data.adjustment],
        currencyCode: "USD",
        decimalPrecision: 2,
      }).amount,
    ).toBe("0");

    const auditRows = await prisma.auditLog.findMany({
      where: {
        action: AuditActions.PAYMENT_DISPUTE_OPENED,
        entityId: opened.data.adjustment.id,
      },
    });
    expect(auditRows).toHaveLength(1);
  }, 60_000);

  afterAll(async () => {
    if (!runDbIntegration) {
      return;
    }
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdAdjustmentIds.length > 0) {
      await prisma.paymentAdjustment.deleteMany({
        where: { id: { in: createdAdjustmentIds } },
      });
    }
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
  });
});

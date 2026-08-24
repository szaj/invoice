import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { AuditActions } from "@/domain/audit/types";
import { PAYMENT_ILLEGAL_TRANSITION, PAYMENT_RECORD_FORBIDDEN } from "@/domain/payments/types";
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
import {
  confirmPayment,
  createPendingPayment,
  failPayment,
  listPayments,
} from "@/server/payments/payment-service";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { MemoryStorageService } from "@/server/storage/memory-storage";
import { updatePaymentMethodSettlementConfiguration } from "@/server/settlement/settlement-service";
import { PrismaSettlementConfigStore } from "@/server/settlement/settlement-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("payment service integration", () => {
  const createdPaymentIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];

  it("creates a pending payment and confirms it with locked settlement math", async () => {
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
    };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee45";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };
    const staff: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee46",
      status: "ACTIVE",
      roleCode: "STAFF",
      assignedCompanyIds: [],
    };

    await prisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        name: "TASK-045 Admin",
        email: `task045-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee47",
        status: "ACTIVE",
      },
      update: {},
    });

    const company = await createCompany(
      admin,
      { displayName: `Payment Svc Co ${Date.now()}` },
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
        invoicePrefix: "PS-",
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
        displayName: `Payment Svc Customer ${Date.now()}`,
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

    const issued = await issueInvoice(admin, draft.data.id, lifecycleDeps);
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      throw new Error(issued.error);
    }

    const staffDenied = await createPendingPayment(
      staff,
      {
        invoiceId: draft.data.id,
        methodCode: "MANUAL",
        invoiceAmountApplied: "40.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
        processorFeeAmount: "1.50",
      },
      paymentDeps,
    );
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
      expect(staffDenied.error).toBe(PAYMENT_RECORD_FORBIDDEN);
    }

    const pending = await createPendingPayment(
      admin,
      {
        invoiceId: draft.data.id,
        methodCode: "MANUAL",
        invoiceAmountApplied: "40.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
        processorFeeAmount: "1.50",
      },
      paymentDeps,
    );
    expect(pending.ok).toBe(true);
    if (!pending.ok) {
      throw new Error(pending.error);
    }
    createdPaymentIds.push(pending.data.id);
    expect(pending.data.status).toBe("PENDING");
    expect(pending.data.companyId).toBe(company.data.id);
    expect(pending.data.customerId).toBe(customer.data.id);
    expect(pending.data.convertedSettlementAmount).toBe("40");
    expect(pending.data.processorFeeAmount).toBe("1.5");
    expect(pending.data.convertedSettlementAmount).not.toBe("38.5");
    expect(pending.data.rateSource).toBe("SAME_CURRENCY");
    expect(pending.data.rateEffectiveAt?.toISOString().slice(0, 10)).toBe("2026-08-24");

    const listed = await listPayments(admin, { companyId: company.data.id }, paymentDeps);
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      throw new Error(listed.error);
    }
    expect(listed.data.some((row) => row.id === pending.data.id)).toBe(true);

    const confirmed = await confirmPayment(admin, pending.data.id, paymentDeps);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      throw new Error(confirmed.error);
    }
    expect(confirmed.data.status).toBe("SUCCESSFUL");
    expect(confirmed.data.invoiceAmountApplied).toBe(pending.data.invoiceAmountApplied);
    expect(confirmed.data.convertedSettlementAmount).toBe(pending.data.convertedSettlementAmount);
    expect(confirmed.data.processorFeeAmount).toBe(pending.data.processorFeeAmount);
    expect(confirmed.data.rateEffectiveAt?.toISOString()).toBe(
      pending.data.rateEffectiveAt?.toISOString(),
    );

    const reconfirm = await confirmPayment(admin, pending.data.id, paymentDeps);
    expect(reconfirm.ok).toBe(false);
    if (!reconfirm.ok) {
      expect(reconfirm.error).toBe(PAYMENT_ILLEGAL_TRANSITION);
    }

    const staffConfirm = await confirmPayment(staff, pending.data.id, paymentDeps);
    expect(staffConfirm.ok).toBe(false);
    if (!staffConfirm.ok) {
      expect(staffConfirm.status).toBe(403);
    }

    const events = await prisma.auditLog.findMany({
      where: {
        entityType: "payment",
        entityId: pending.data.id,
      },
      orderBy: { occurredAt: "asc" },
    });
    expect(events.map((event) => event.action)).toEqual([
      AuditActions.PAYMENT_CREATED,
      AuditActions.PAYMENT_CONFIRMED,
    ]);

    const failPending = await createPendingPayment(
      admin,
      {
        invoiceId: draft.data.id,
        methodCode: "MANUAL",
        invoiceAmountApplied: "10.00",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-24",
      },
      paymentDeps,
    );
    expect(failPending.ok).toBe(true);
    if (!failPending.ok) {
      throw new Error(failPending.error);
    }
    createdPaymentIds.push(failPending.data.id);
    const failed = await failPayment(admin, failPending.data.id, paymentDeps);
    expect(failed.ok).toBe(true);
    if (!failed.ok) {
      throw new Error(failed.error);
    }
    expect(failed.data.status).toBe("FAILED");
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
  });
});

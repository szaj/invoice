import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuditActions } from "@/domain/audit/types";
import { computeCbrf } from "@/domain/money";
import { PAYMENT_ADJUST_FORBIDDEN, REFUND_EXCEEDS_PAYMENT } from "@/domain/refunds/types";
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
import { PrismaPaymentAdjustmentStore } from "@/server/payments/payment-adjustment-repository";
import { recordManualPayment } from "@/server/payments/payment-service";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { processPartialRefund } from "@/server/refunds/refund-service";
import { MemoryStorageService } from "@/server/storage/memory-storage";
import { updatePaymentMethodSettlementConfiguration } from "@/server/settlement/settlement-service";
import { PrismaSettlementConfigStore } from "@/server/settlement/settlement-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("partial refund workflow integration (TASK-065)", () => {
  const createdAdjustmentIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];

  it("creates a partial REFUND PROCESSED adjustment without rewriting the original payment (E2E-15)", async () => {
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
    const refundDeps = {
      payments: new PrismaPaymentStore(),
      invoices: new PrismaInvoiceStore(),
      adjustments: new PrismaPaymentAdjustmentStore(),
      enforceTransactionalCompanyScope: paymentDeps.enforceTransactionalCompanyScope,
    };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee65";
    const adminAuthId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee68";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };
    const staff: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee69",
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
        name: "TASK-065 Admin",
        email: `task065-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: adminAuthId,
        status: "ACTIVE",
      },
    });

    const company = await createCompany(
      admin,
      { displayName: `Partial Refund Co ${Date.now()}` },
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
        invoicePrefix: "PR-",
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
        displayName: `Partial Refund Customer ${Date.now()}`,
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
        lineItems: [{ description: "Service", quantity: "1", unitRate: "90.00" }],
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
        invoiceAmountApplied: "90.00",
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
    const paymentBefore = recorded.data;

    const staffDenied = await processPartialRefund(
      staff,
      paymentBefore.id,
      { invoiceAmount: "30.00" },
      refundDeps,
    );
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
      expect(staffDenied.error).toBe(PAYMENT_ADJUST_FORBIDDEN);
    }

    const refunded = await processPartialRefund(
      admin,
      paymentBefore.id,
      { invoiceAmount: "30.00", reason: "Partial refund", merchantReference: "PRF-065" },
      refundDeps,
    );
    expect(refunded.ok).toBe(true);
    if (!refunded.ok) {
      throw new Error(refunded.error);
    }
    createdAdjustmentIds.push(refunded.data.adjustment.id);

    expect(refunded.data.lifecycle).toBe("REFUNDED");
    expect(refunded.data.adjustment.type).toBe("REFUND");
    expect(refunded.data.adjustment.status).toBe("PROCESSED");
    expect(refunded.data.adjustment.invoiceAmount).toBe("30");
    expect(refunded.data.adjustment.settlementAmount).toBe("30");
    expect(refunded.data.payment.status).toBe("SUCCESSFUL");
    expect(refunded.data.payment.invoiceAmountApplied).toBe(paymentBefore.invoiceAmountApplied);
    expect(refunded.data.payment.convertedSettlementAmount).toBe(
      paymentBefore.convertedSettlementAmount,
    );
    expect(refunded.data.payment.fixedConversionRate).toBe(paymentBefore.fixedConversionRate);

    const persisted = await prisma.paymentAdjustment.findUniqueOrThrow({
      where: { id: refunded.data.adjustment.id },
    });
    expect(persisted.paymentId).toBe(paymentBefore.id);
    expect(persisted.type).toBe("REFUND");
    expect(persisted.status).toBe("PROCESSED");
    expect(persisted.amount.toString()).toBe("30");
    expect(persisted.invoiceAmount?.toString()).toBe("30");

    const paymentAfter = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentBefore.id },
    });
    expect(paymentAfter.status).toBe("SUCCESSFUL");
    expect(paymentAfter.invoiceAmountApplied.toString()).toBe(paymentBefore.invoiceAmountApplied);
    expect(paymentAfter.convertedSettlementAmount.toString()).toBe(
      paymentBefore.convertedSettlementAmount,
    );
    expect(paymentAfter.fixedConversionRate.toString()).toBe(paymentBefore.fixedConversionRate);

    expect(
      computeCbrf({
        adjustments: [refunded.data.adjustment],
        currencyCode: "USD",
        decimalPrecision: 2,
      }).amount,
    ).toBe("30");

    const second = await processPartialRefund(
      admin,
      paymentBefore.id,
      { invoiceAmount: "60.00", reason: "Remaining" },
      refundDeps,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) {
      throw new Error(second.error);
    }
    createdAdjustmentIds.push(second.data.adjustment.id);

    const over = await processPartialRefund(
      admin,
      paymentBefore.id,
      { invoiceAmount: "0.01" },
      refundDeps,
    );
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.status).toBe(400);
      expect(over.error).toBe(REFUND_EXCEEDS_PAYMENT);
    }

    const auditRows = await prisma.auditLog.findMany({
      where: {
        action: AuditActions.PAYMENT_REFUND_PROCESSED,
        entityId: refunded.data.adjustment.id,
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

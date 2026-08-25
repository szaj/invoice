import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuditActions } from "@/domain/audit/types";
import { computeCbrf } from "@/domain/money";
import { PAYMENT_ADJUST_FORBIDDEN } from "@/domain/payments/adjustment-history";
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
  addPaymentAdjustmentNote,
  cancelPaymentAdjustment,
  listPaymentAdjustments,
} from "@/server/payments/adjustment-history-service";
import { PrismaPaymentAdjustmentStore } from "@/server/payments/payment-adjustment-repository";
import { recordManualPayment } from "@/server/payments/payment-service";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { processFullRefund } from "@/server/refunds/refund-service";
import { MemoryStorageService } from "@/server/storage/memory-storage";
import { updatePaymentMethodSettlementConfiguration } from "@/server/settlement/settlement-service";
import { PrismaSettlementConfigStore } from "@/server/settlement/settlement-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("adjustment history and notes integration (TASK-068)", () => {
  const createdAdjustmentIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCompanyIds: string[] = [];

  it("lists adjustments, adds note, cancels refund and excludes cancelled from CB/RF", async () => {
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
    const historyDeps = {
      payments: new PrismaPaymentStore(),
      invoices: new PrismaInvoiceStore(),
      adjustments: new PrismaPaymentAdjustmentStore(),
      enforceTransactionalCompanyScope: paymentDeps.enforceTransactionalCompanyScope,
    };
    const refundDeps = {
      payments: new PrismaPaymentStore(),
      invoices: new PrismaInvoiceStore(),
      adjustments: new PrismaPaymentAdjustmentStore(),
      enforceTransactionalCompanyScope: paymentDeps.enforceTransactionalCompanyScope,
    };

    const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee8a";
    const adminAuthId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee8b";
    const admin: AuthorizationPrincipal = {
      userId: adminId,
      status: "ACTIVE",
      roleCode: "ADMIN",
    };
    const staff: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee8c",
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
        name: "TASK-068 Admin",
        email: `task068-admin-${Date.now()}@example.com`,
        supabaseAuthUserId: adminAuthId,
        status: "ACTIVE",
      },
    });

    const company = await createCompany(
      admin,
      { displayName: `Adjustment History Co ${Date.now()}` },
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
        invoicePrefix: "AH-",
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
        displayName: `Adjustment History Customer ${Date.now()}`,
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
        items: [{ description: "Service", quantity: "1", unitPrice: "100", taxRate: "0" }],
      },
      lineDeps,
    );

    const issued = await issueInvoice(admin, draft.data.id, lifecycleDeps);
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      throw new Error("issue failed");
    }

    const payment = await recordManualPayment(
      admin,
      {
        invoiceId: draft.data.id,
        invoiceAmountApplied: "100",
        settlementCurrencyCode: "USD",
        paymentDate: "2026-08-10",
      },
      paymentDeps,
    );
    expect(payment.ok).toBe(true);
    if (!payment.ok) {
      throw new Error("payment failed");
    }
    createdPaymentIds.push(payment.data.id);

    const lockedInvoice = payment.data.invoiceAmountApplied;
    const lockedSettlement = payment.data.convertedSettlementAmount;

    const refund = await processFullRefund(admin, payment.data.id, {}, refundDeps);
    expect(refund.ok).toBe(true);
    if (!refund.ok) {
      throw new Error("refund failed");
    }
    createdAdjustmentIds.push(refund.data.adjustment.id);

    const note = await addPaymentAdjustmentNote(
      admin,
      payment.data.id,
      {
        notes: "Merchant confirmed case open",
        reason: "ops_follow_up",
        merchantReference: "CASE-068",
      },
      historyDeps,
    );
    expect(note.ok).toBe(true);
    if (!note.ok) {
      throw new Error("note failed");
    }
    createdAdjustmentIds.push(note.data.adjustment.id);
    expect(note.data.adjustment.type).toBe("NOTE");
    expect(note.data.adjustment.status).toBe("OPEN");
    expect(note.data.adjustment.amount).toBe("0");

    const staffDenied = await addPaymentAdjustmentNote(
      staff,
      payment.data.id,
      { notes: "denied" },
      historyDeps,
    );
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.error).toBe(PAYMENT_ADJUST_FORBIDDEN);
    }

    const listedBefore = await listPaymentAdjustments(admin, payment.data.id, historyDeps);
    expect(listedBefore.ok).toBe(true);
    if (!listedBefore.ok) {
      throw new Error("list failed");
    }
    expect(listedBefore.data.adjustments.length).toBeGreaterThanOrEqual(2);

    const beforeCancel = computeCbrf({
      adjustments: listedBefore.data.adjustments.map((row) => ({
        type: row.type,
        status: row.status,
        amount: row.amount,
      })),
      currencyCode: "USD",
      decimalPrecision: 2,
    });
    expect(beforeCancel.amount).not.toBe("0");

    const cancelled = await cancelPaymentAdjustment(
      admin,
      payment.data.id,
      refund.data.adjustment.id,
      { reason: "duplicate_entry" },
      historyDeps,
    );
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) {
      throw new Error("cancel failed");
    }
    expect(cancelled.data.adjustment.status).toBe("CANCELLED");

    const listedAfter = await listPaymentAdjustments(admin, payment.data.id, historyDeps);
    expect(listedAfter.ok).toBe(true);
    if (!listedAfter.ok) {
      throw new Error("list after cancel failed");
    }
    expect(listedAfter.data.adjustments.some((row) => row.status === "CANCELLED")).toBe(true);
    expect(listedAfter.data.adjustments.some((row) => row.type === "NOTE")).toBe(true);

    const afterCancel = computeCbrf({
      adjustments: listedAfter.data.adjustments.map((row) => ({
        type: row.type,
        status: row.status,
        amount: row.amount,
      })),
      currencyCode: "USD",
      decimalPrecision: 2,
    });
    expect(afterCancel.amount).toBe("0");

    const paymentRow = await prisma.payment.findUniqueOrThrow({ where: { id: payment.data.id } });
    expect(paymentRow.status).toBe("SUCCESSFUL");
    expect(paymentRow.invoiceAmountApplied.toString()).toBe(lockedInvoice);
    expect(paymentRow.convertedSettlementAmount.toString()).toBe(lockedSettlement);

    const auditCancel = await prisma.auditLog.findFirst({
      where: {
        entityId: refund.data.adjustment.id,
        action: AuditActions.PAYMENT_ADJUSTMENT_CANCELLED,
      },
      orderBy: { occurredAt: "desc" },
    });
    expect(auditCancel).not.toBeNull();

    const auditNote = await prisma.auditLog.findFirst({
      where: {
        entityId: note.data.adjustment.id,
        action: AuditActions.PAYMENT_ADJUSTMENT_NOTE_ADDED,
      },
      orderBy: { occurredAt: "desc" },
    });
    expect(auditNote).not.toBeNull();

    const stillThere = await prisma.paymentAdjustment.findUnique({
      where: { id: refund.data.adjustment.id },
    });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.status).toBe("CANCELLED");
  });

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
    await prisma.user.deleteMany({
      where: { id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee8a" },
    });
  });
});

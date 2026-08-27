import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuditActions } from "@/domain/audit/types";
import { COMPLIANCE_NOTES_FORBIDDEN, COMPLIANCE_STATUS_FORBIDDEN } from "@/domain/compliance/types";
import { updateCompanyBranding } from "@/server/companies/branding-service";
import { PrismaCompanyBrandingStore } from "@/server/companies/branding-repository";
import { createCompany } from "@/server/companies/company-service";
import { PrismaCompanyStore } from "@/server/companies/company-repository";
import { updateCompanyCurrencyConfiguration } from "@/server/companies/company-currency-service";
import { PrismaCompanyCurrencyStore } from "@/server/companies/company-currency-repository";
import { addComplianceNote, updateComplianceStatus } from "@/server/compliance/compliance-service";
import { PrismaComplianceStore } from "@/server/compliance/compliance-repository";
import { createCustomer } from "@/server/customers/customer-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { createDraftInvoice } from "@/server/invoices/invoice-draft-service";
import { issueInvoice } from "@/server/invoices/invoice-lifecycle-service";
import { PrismaInvoiceNumberStore } from "@/server/invoices/invoice-number-repository";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { replaceDraftInvoiceLineItems } from "@/server/invoices/invoice-line-item-service";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { MemoryStorageService } from "@/server/storage/memory-storage";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)(
  "compliance notes and reason codes integration (TASK-073)",
  () => {
    const createdInvoiceIds: string[] = [];
    const createdCustomerIds: string[] = [];
    const createdCompanyIds: string[] = [];
    const createdReviewIds: string[] = [];
    const createdUserIds: string[] = [];

    it("approve/flag with notes write audit events and Staff is denied", async () => {
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
      const complianceDeps = {
        store: new PrismaComplianceStore(),
        invoices: new PrismaInvoiceStore(),
        payments: new PrismaPaymentStore(),
        customers: new PrismaCustomerStore(),
        enforceTransactionalCompanyScope: async (
          actor: AuthorizationPrincipal,
          companyId: string,
        ) => {
          assertCompanyAccess(actor, companyId);
          return { ok: true as const, data: true as const };
        },
      };

      const adminId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee83";
      const adminAuthId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee84";
      const admin: AuthorizationPrincipal = {
        userId: adminId,
        status: "ACTIVE",
        roleCode: "ADMIN",
      };
      const staff: AuthorizationPrincipal = {
        userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee85",
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
          name: "TASK-073 Admin",
          email: `task073-admin-${Date.now()}@example.com`,
          supabaseAuthUserId: adminAuthId,
          status: "ACTIVE",
        },
      });
      createdUserIds.push(adminId);

      const company = await createCompany(
        admin,
        { displayName: `TASK-073 Co ${Date.now()}` },
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
          invoicePrefix: "N7-",
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
          displayName: `TASK-073 Customer ${Date.now()}`,
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
          lineItems: [{ description: "Service", quantity: "1", unitRate: "50.00" }],
        },
        lineDeps,
      );

      const issued = await issueInvoice(admin, draft.data.id, lifecycleDeps);
      expect(issued.ok).toBe(true);
      if (!issued.ok) {
        throw new Error(issued.error);
      }

      const staffStatusDenied = await updateComplianceStatus(
        staff,
        {
          subjectType: "INVOICE",
          subjectId: draft.data.id,
          status: "FLAGGED",
          reason: "NOPE",
          notes: "staff attempt",
        },
        complianceDeps,
      );
      expect(staffStatusDenied.ok).toBe(false);
      if (!staffStatusDenied.ok) {
        expect(staffStatusDenied.status).toBe(403);
        expect(staffStatusDenied.error).toBe(COMPLIANCE_STATUS_FORBIDDEN);
      }

      const staffNoteDenied = await addComplianceNote(
        staff,
        {
          subjectType: "INVOICE",
          subjectId: draft.data.id,
          notes: "staff note",
        },
        complianceDeps,
      );
      expect(staffNoteDenied.ok).toBe(false);
      if (!staffNoteDenied.ok) {
        expect(staffNoteDenied.status).toBe(403);
        expect(staffNoteDenied.error).toBe(COMPLIANCE_NOTES_FORBIDDEN);
      }

      const flagged = await updateComplianceStatus(
        admin,
        {
          subjectType: "INVOICE",
          subjectId: draft.data.id,
          status: "FLAGGED",
          reason: "MISSING_DOCS",
          notes: "Need KYC docs",
          evidenceRefs: ["compliance/evidence/demo-1"],
        },
        complianceDeps,
      );
      expect(flagged.ok).toBe(true);
      if (!flagged.ok) {
        throw new Error(flagged.error);
      }
      expect(flagged.data.review).not.toBeNull();
      if (flagged.data.review) {
        createdReviewIds.push(flagged.data.review.id);
        expect(flagged.data.review.notes).toBe("Need KYC docs");
        expect(flagged.data.review.reason).toBe("MISSING_DOCS");
        expect(flagged.data.review.evidenceRefs).toEqual(["compliance/evidence/demo-1"]);
      }

      const note = await addComplianceNote(
        admin,
        {
          subjectType: "INVOICE",
          subjectId: draft.data.id,
          notes: "Customer emailed docs",
          reason: "FOLLOW_UP",
          resolutionNotes: "Awaiting final check",
        },
        complianceDeps,
      );
      expect(note.ok).toBe(true);
      if (!note.ok) {
        throw new Error(note.error);
      }
      createdReviewIds.push(note.data.review.id);
      expect(note.data.status).toBe("FLAGGED");

      const approved = await updateComplianceStatus(
        admin,
        {
          subjectType: "INVOICE",
          subjectId: draft.data.id,
          status: "APPROVED",
          reason: "CLEARED",
          resolutionNotes: "Docs verified",
        },
        complianceDeps,
      );
      expect(approved.ok).toBe(true);
      if (!approved.ok) {
        throw new Error(approved.error);
      }
      if (approved.data.review) {
        createdReviewIds.push(approved.data.review.id);
      }

      const statusAudits = await prisma.auditLog.findMany({
        where: {
          action: AuditActions.COMPLIANCE_STATUS_UPDATED,
          entityId: draft.data.id,
        },
      });
      expect(statusAudits.length).toBeGreaterThanOrEqual(2);
      expect(statusAudits.some((row) => row.reason === "MISSING_DOCS")).toBe(true);
      expect(statusAudits.some((row) => row.reason === "CLEARED")).toBe(true);

      const noteAudits = await prisma.auditLog.findMany({
        where: {
          action: AuditActions.COMPLIANCE_NOTE_ADDED,
          entityId: note.data.review.id,
        },
      });
      expect(noteAudits.length).toBe(1);
      expect(noteAudits[0]?.reason).toBe("FOLLOW_UP");

      const reviewRow = await prisma.complianceReview.findUnique({
        where: { id: flagged.data.review!.id },
      });
      expect(reviewRow?.notes).toBe("Need KYC docs");
      expect(reviewRow?.reason).toBe("MISSING_DOCS");
      expect(reviewRow?.evidenceRefs).toEqual(["compliance/evidence/demo-1"]);
    }, 120_000);

    afterAll(async () => {
      if (!runDbIntegration) {
        return;
      }
      const { getPrisma } = await import("@/server/db/client");
      const prisma = getPrisma();
      if (createdReviewIds.length > 0) {
        await prisma.complianceReview.deleteMany({ where: { id: { in: createdReviewIds } } });
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
  },
);

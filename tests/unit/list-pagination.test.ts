import { describe, expect, it } from "vitest";

import { parseCustomerListSearchParams } from "@/domain/customers/list-query";
import { parseInvoiceDraftListSearchParams } from "@/domain/invoices/schema";
import {
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  LIST_P95_BUDGET_MS,
  paginateRows,
  resolveListPagination,
} from "@/domain/lists/pagination";
import { parsePaymentListSearchParams } from "@/domain/payments/schema";
import { listDraftInvoices } from "@/server/invoices/invoice-draft-service";
import { listCustomers } from "@/server/customers/customer-service";
import { listPayments } from "@/server/payments/payment-service";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import type { InvoiceRecord } from "@/domain/invoices/types";
import type { CustomerRecord } from "@/domain/customers/types";
import type { PaymentRecord } from "@/domain/payments/types";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";
const INVOICE_ID = "33333333-3333-4333-8333-333333333333";
const ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function admin(): AuthorizationPrincipal {
  return {
    userId: ADMIN_ID,
    status: "ACTIVE",
    roleCode: "ADMIN",
    assignedCompanyIds: [],
  };
}

describe("list pagination (TASK-098)", () => {
  it("clamps pageSize to the interactive max and never returns unbounded slices", () => {
    expect(resolveListPagination().pageSize).toBe(LIST_DEFAULT_PAGE_SIZE);
    expect(resolveListPagination({ page: 0, pageSize: 500 }).pageSize).toBe(LIST_MAX_PAGE_SIZE);
    expect(resolveListPagination({ page: 0, pageSize: 500 }).page).toBe(1);
    expect(LIST_P95_BUDGET_MS).toBe(2_000);

    const rows = Array.from({ length: 120 }, (_, index) => index);
    const page = paginateRows(rows, 1, LIST_MAX_PAGE_SIZE);
    expect(page.rows).toHaveLength(LIST_MAX_PAGE_SIZE);
    expect(page.totalCount).toBe(120);
    expect(page.pageSize).toBeLessThanOrEqual(LIST_MAX_PAGE_SIZE);
  });

  it("parses page/pageSize on invoice, customer, and payment list search params", () => {
    expect(
      parseInvoiceDraftListSearchParams({
        companyId: COMPANY_A,
        status: "ISSUED",
        page: "2",
        pageSize: "25",
      }),
    ).toMatchObject({ companyId: COMPANY_A, status: "ISSUED", page: 2, pageSize: 25 });

    expect(
      parseCustomerListSearchParams({
        q: "acme",
        page: "3",
        pageSize: "10",
      }),
    ).toMatchObject({ q: "acme", page: 3, pageSize: 10 });

    expect(
      parsePaymentListSearchParams({
        companyId: COMPANY_A,
        page: "1",
        pageSize: "500",
      }),
    ).toMatchObject({ companyId: COMPANY_A, page: 1, pageSize: 500 });
  });

  it("invoice, customer, and payment list services return bounded pages", async () => {
    const invoices: InvoiceRecord[] = Array.from({ length: 12 }, (_, index) => ({
      id: `eeeeeeee-eeee-4eee-8eee-${String(index + 1).padStart(12, "0")}`,
      companyId: COMPANY_A,
      customerId: CUSTOMER_ID,
      invoiceNumber: `INV-${index + 1}`,
      invoiceDate: new Date("2026-08-21T00:00:00.000Z"),
      dueDate: new Date("2026-09-21T00:00:00.000Z"),
      currencyCode: "USD",
      referencePo: null,
      assignedStaffUserId: null,
      status: "DRAFT",
      complianceStatus: "NOT_REVIEWED",
      internalNotes: null,
      customerNotes: null,
      subtotal: "0",
      discountTotal: "0",
      taxTotal: "0",
      invoiceTotal: "0",
      confirmedPaidAmount: "0",
      outstandingAmount: "0",
      cancellationReason: null,
      cancelledAt: null,
      cancelledByUserId: null,
      createdByUserId: ADMIN_ID,
      updatedByUserId: ADMIN_ID,
      createdAt: new Date("2026-08-21T00:00:00.000Z"),
      updatedAt: new Date("2026-08-21T00:00:00.000Z"),
    }));

    const invoiceResult = await listDraftInvoices(
      admin(),
      { companyId: COMPANY_A, status: "DRAFT", page: 2, pageSize: 5 },
      {
        store: {
          async listInvoicesPage(filters) {
            const start = (filters.page - 1) * filters.pageSize;
            return {
              rows: invoices.slice(start, start + filters.pageSize),
              totalCount: invoices.length,
            };
          },
          async getInvoiceById() {
            return null;
          },
          async createInvoice() {
            throw new Error("unused");
          },
          async updateInvoice() {
            throw new Error("unused");
          },
        },
        customerStore: {
          async getCustomerById() {
            return null;
          },
        },
      },
    );
    expect(invoiceResult.ok).toBe(true);
    if (invoiceResult.ok) {
      expect(invoiceResult.data.rows).toHaveLength(5);
      expect(invoiceResult.data.totalCount).toBe(12);
      expect(invoiceResult.data.page).toBe(2);
      expect(invoiceResult.data.pageSize).toBe(5);
    }

    const customers: CustomerRecord[] = Array.from({ length: 8 }, (_, index) => ({
      id: `dddddddd-dddd-4ddd-8ddd-${String(index + 1).padStart(12, "0")}`,
      displayName: `Customer ${index + 1}`,
      contactPerson: null,
      customerType: "BUSINESS",
      email: null,
      phone: null,
      alternatePhone: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      region: null,
      postalCode: null,
      countryCode: null,
      taxRegistrationId: null,
      website: null,
      defaultInvoiceCurrencyCode: null,
      defaultCompanyId: COMPANY_A,
      paymentPreference: null,
      status: "ACTIVE",
      complianceStatus: "NOT_REVIEWED",
      assignedStaffUserId: null,
      internalNotes: null,
      tags: [],
      companyIds: [COMPANY_A],
      createdByUserId: ADMIN_ID,
      updatedByUserId: ADMIN_ID,
      createdAt: new Date("2026-08-21T00:00:00.000Z"),
      updatedAt: new Date("2026-08-21T00:00:00.000Z"),
    }));

    const customerResult = await listCustomers(
      admin(),
      { page: 1, pageSize: 3 },
      {
        store: {
          async listCustomersPage(_scope, search) {
            const start = (search.page - 1) * search.pageSize;
            return {
              rows: customers.slice(start, start + search.pageSize),
              totalCount: customers.length,
            };
          },
          async getCustomerById() {
            return null;
          },
          async createCustomer() {
            throw new Error("unused");
          },
          async updateCustomer() {
            throw new Error("unused");
          },
          async setCustomerCompanies() {
            throw new Error("unused");
          },
          async setStatus() {
            throw new Error("unused");
          },
          async findPotentialDuplicates() {
            return [];
          },
        },
      },
    );
    expect(customerResult.ok).toBe(true);
    if (customerResult.ok) {
      expect(customerResult.data.rows).toHaveLength(3);
      expect(customerResult.data.totalCount).toBe(8);
      expect(customerResult.data.pageSize).toBeLessThanOrEqual(LIST_MAX_PAGE_SIZE);
    }

    const payments: PaymentRecord[] = Array.from({ length: 9 }, (_, index) => ({
      id: `ffffffff-ffff-4fff-8fff-${String(index + 1).padStart(12, "0")}`,
      companyId: COMPANY_A,
      invoiceId: INVOICE_ID,
      customerId: CUSTOMER_ID,
      methodCode: "MANUAL",
      externalTransactionId: `txn-${index + 1}`,
      status: "SUCCESSFUL",
      complianceStatus: "NOT_REVIEWED",
      invoiceCurrencyCode: "USD",
      invoiceAmountApplied: "10.00",
      settlementCurrencyCode: "USD",
      fixedConversionRate: "1",
      rateVersionId: null,
      rateSource: "SAME_CURRENCY",
      rateEffectiveAt: new Date("2026-08-24T00:00:00.000Z"),
      convertedSettlementAmount: "10.00",
      processorFeeAmount: null,
      actualReceivedAmount: null,
      paymentDate: new Date("2026-08-24T00:00:00.000Z"),
      receivedAt: null,
      source: "MANUAL",
      notes: null,
      createdByUserId: ADMIN_ID,
      confirmedByUserId: ADMIN_ID,
      createdAt: new Date("2026-08-24T00:00:00.000Z"),
      updatedAt: new Date("2026-08-24T00:00:00.000Z"),
    }));

    const paymentResult = await listPayments(
      admin(),
      { companyId: COMPANY_A, page: 1, pageSize: 4 },
      {
        payments: {
          async listPaymentsPage(filters) {
            const start = (filters.page - 1) * filters.pageSize;
            return {
              rows: payments.slice(start, start + filters.pageSize),
              totalCount: payments.length,
              invoiceNumberById: new Map(),
            };
          },
          async listPayments() {
            throw new Error("listPayments must not load the unbounded company list");
          },
          async getPaymentById() {
            return null;
          },
          async getPaymentByExternalTransaction() {
            return null;
          },
          async createPayment() {
            throw new Error("unused");
          },
          async updatePaymentLifecycle() {
            return null;
          },
        },
        invoices: {
          async getInvoiceById() {
            return null;
          },
          async listInvoices() {
            throw new Error("payment list must not load all invoices");
          },
          async updatePaymentAllocation() {
            throw new Error("unused");
          },
        },
        customers: {
          async getCustomerById() {
            return null;
          },
        },
        settlement: {
          async getCompanySettlementConfiguration() {
            throw new Error("unused");
          },
        },
        currencies: {
          async findByCode() {
            return null;
          },
        },
      },
    );
    expect(paymentResult.ok).toBe(true);
    if (paymentResult.ok) {
      expect(paymentResult.data.rows).toHaveLength(4);
      expect(paymentResult.data.totalCount).toBe(9);
      expect(paymentResult.data.pageSize).toBeLessThanOrEqual(LIST_MAX_PAGE_SIZE);
    }
  });
});

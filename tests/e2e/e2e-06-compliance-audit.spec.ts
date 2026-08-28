import { expect, test } from "@playwright/test";

import { loginViaUi } from "./fixtures/auth";
import { apiOk } from "./fixtures/api-client";
import {
  hasComplianceCredentials,
  resolveAdminCredentials,
  resolveComplianceCredentials,
} from "./fixtures/credentials";

const describeCompliance = hasComplianceCredentials() ? test.describe : test.describe.skip;

describeCompliance("E2E-06 — compliance review and audit trail", () => {
  test.describe.configure({ mode: "serial" });

  const marker = `e2e06-${Date.now()}`;
  let paymentId = "";

  test("creates a successful manual payment as admin setup", async ({ page }) => {
    const admin = resolveAdminCredentials()!;
    await loginViaUi(page, admin);

    const companies = await apiOk<{ ok: true; companies: Array<{ id: string }> }>(
      page,
      "/api/companies",
    );
    const companyId = companies.companies[0]?.id;
    expect(companyId).toBeTruthy();

    const customers = await apiOk<{ ok: true; customers: Array<{ id: string }> }>(
      page,
      `/api/customers?companyId=${companyId}`,
    );
    expect(customers.customers.length).toBeGreaterThan(0);
    const customerId = customers.customers[0]!.id;

    const draft = await apiOk<{ ok: true; invoice: { id: string } }>(page, "/api/invoices", {
      method: "POST",
      body: {
        companyId,
        customerId,
        invoiceDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date().toISOString().slice(0, 10),
        currencyCode: "USD",
        referencePo: "",
        assignedStaffUserId: null,
        internalNotes: "",
        customerNotes: "",
      },
    });

    await apiOk(page, `/api/invoices/${draft.invoice.id}/items`, {
      method: "PUT",
      body: {
        lineItems: [
          {
            description: `Compliance seed ${marker}`,
            quantity: "1",
            unitRate: "50.00",
            taxRatePercent: "0",
          },
        ],
      },
    });
    await apiOk(page, `/api/invoices/${draft.invoice.id}/issue`, { method: "POST", body: {} });

    const payment = await apiOk<{ ok: true; payment: { id: string } }>(
      page,
      "/api/payments/manual",
      {
        method: "POST",
        body: {
          invoiceId: draft.invoice.id,
          invoiceAmountApplied: "50.00",
          settlementCurrencyCode: "USD",
          paymentDate: new Date().toISOString().slice(0, 10),
          externalTransactionId: `e2e06-${marker}`,
          notes: marker,
        },
      },
    );
    paymentId = payment.payment.id;
  });

  test("compliance user approves the payment and writes audit events", async ({ page }) => {
    const compliance = resolveComplianceCredentials()!;
    await loginViaUi(page, compliance);

    await page.goto("/compliance");
    await expect(page.getByRole("heading", { name: /compliance/i })).toBeVisible();

    await page.goto(`/compliance/payment/${paymentId}`);
    await expect(page.getByRole("heading", { name: "Payment review" })).toBeVisible();

    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText(/approved|saved/i)).toBeVisible({ timeout: 20_000 });
  });

  test("admin sees compliance status change in audit log", async ({ page }) => {
    const admin = resolveAdminCredentials()!;
    await loginViaUi(page, admin);

    const audit = await apiOk<{ ok: true; events: Array<{ action: string }> }>(
      page,
      `/api/audit?entityType=PAYMENT&entityId=${paymentId}`,
    );
    expect(audit.events.some((row) => row.action.toLowerCase().includes("compliance"))).toBe(true);
  });
});

test.describe("E2E-06 credential note", () => {
  test("documents compliance credential requirement", () => {
    if (!hasComplianceCredentials()) {
      test.info().annotations.push({
        type: "skip-reason",
        description: "Set E2E_COMPLIANCE_EMAIL/PASSWORD to run live compliance UI flow.",
      });
    }
  });
});

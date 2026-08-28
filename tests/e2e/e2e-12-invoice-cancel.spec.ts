import { expect, test } from "@playwright/test";

import { loginViaUi } from "./fixtures/auth";
import { apiOk } from "./fixtures/api-client";
import { hasAdminCredentials, resolveAdminCredentials } from "./fixtures/credentials";

const describeAdmin = hasAdminCredentials() ? test.describe : test.describe.skip;

describeAdmin("E2E-12 — issued invoice cancellation", () => {
  test.describe.configure({ mode: "serial" });

  const marker = `e2e12-${Date.now()}`;
  let invoiceId = "";

  test("issues an invoice and cancels it with a required reason", async ({ page }) => {
    const admin = resolveAdminCredentials()!;
    await loginViaUi(page, admin);

    const companies = await apiOk<{ ok: true; companies: Array<{ id: string }> }>(
      page,
      "/api/companies",
    );
    const companyId = companies.companies[0]!.id;
    const customers = await apiOk<{ ok: true; customers: Array<{ id: string }> }>(
      page,
      `/api/customers?companyId=${companyId}`,
    );
    expect(customers.customers.length).toBeGreaterThan(0);

    const draft = await apiOk<{ ok: true; invoice: { id: string } }>(page, "/api/invoices", {
      method: "POST",
      body: {
        companyId,
        customerId: customers.customers[0]!.id,
        invoiceDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date().toISOString().slice(0, 10),
        currencyCode: "USD",
        referencePo: "",
        assignedStaffUserId: null,
        internalNotes: "",
        customerNotes: "",
      },
    });
    invoiceId = draft.invoice.id;

    await apiOk(page, `/api/invoices/${invoiceId}/items`, {
      method: "PUT",
      body: {
        lineItems: [
          {
            description: `Cancel seed ${marker}`,
            quantity: "1",
            unitRate: "25.00",
            taxRatePercent: "0",
          },
        ],
      },
    });
    await apiOk(page, `/api/invoices/${invoiceId}/issue`, { method: "POST", body: {} });

    await page.goto(`/invoices/${invoiceId}`);
    await page.getByRole("button", { name: "Cancel invoice" }).click();
    await page.locator(`#cancel-reason-${invoiceId}`).fill(`Customer withdrew — ${marker}`);
    await page.getByRole("button", { name: "Confirm cancel" }).click();
    await expect(page.getByText(/cancelled/i)).toBeVisible({ timeout: 20_000 });
  });

  test("preserves PDF history and writes a cancellation audit event", async ({ page }) => {
    const admin = resolveAdminCredentials()!;
    await loginViaUi(page, admin);
    await page.goto(`/invoices/${invoiceId}`);

    await expect(page.getByTestId("invoice-pdf-download")).toBeVisible();

    const audit = await apiOk<{ ok: true; events: Array<{ action: string }> }>(
      page,
      `/api/audit?entityType=INVOICE&entityId=${invoiceId}`,
    );
    expect(audit.events.some((row) => row.action.includes("cancel"))).toBe(true);
  });
});

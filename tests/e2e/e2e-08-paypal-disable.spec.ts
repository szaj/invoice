import { expect, test } from "@playwright/test";

import { loginViaUi } from "./fixtures/auth";
import { apiOk } from "./fixtures/api-client";
import { hasAdminCredentials, resolveAdminCredentials } from "./fixtures/credentials";

const describeAdmin = hasAdminCredentials() ? test.describe : test.describe.skip;

describeAdmin("E2E-08 — disable PayPal for one company", () => {
  test.describe.configure({ mode: "serial" });

  let companyId = "";
  let invoiceId = "";

  test("disables PayPal on the gateway screen", async ({ page }) => {
    const admin = resolveAdminCredentials()!;
    await loginViaUi(page, admin);

    const companies = await apiOk<{ ok: true; companies: Array<{ id: string }> }>(
      page,
      "/api/companies",
    );
    companyId = companies.companies[0]!.id;

    await page.goto(`/companies/${companyId}/gateways`);
    const paypalPanel = page.locator("form").filter({ hasText: "PayPal" });
    await paypalPanel.getByLabel("Method enabled").setChecked(false);
    await paypalPanel.getByRole("button", { name: "Save configuration" }).click();
    await expect(paypalPanel.getByText(/saved|configuration saved/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("checkout options omit PayPal while historical payments remain listed", async ({ page }) => {
    const admin = resolveAdminCredentials()!;
    await loginViaUi(page, admin);

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
            description: "PayPal disable checkout probe",
            quantity: "1",
            unitRate: "10.00",
            taxRatePercent: "0",
          },
        ],
      },
    });
    await apiOk(page, `/api/invoices/${invoiceId}/issue`, { method: "POST", body: {} });

    const options = await apiOk<{
      ok: true;
      options: Array<{ methodCode: string }>;
    }>(page, `/api/payments/checkout-options?invoiceId=${invoiceId}`);
    expect(options.options.some((row) => row.methodCode === "PAYPAL")).toBe(false);

    await page.goto("/payments");
    await expect(page.getByRole("heading", { name: /payments/i })).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";

import { loginViaUi } from "./fixtures/auth";
import { apiOk } from "./fixtures/api-client";
import {
  hasAdminCredentials,
  hasStaffCredentials,
  resolveAdminCredentials,
  resolveStaffCredentials,
} from "./fixtures/credentials";

const credentials = resolveStaffCredentials() ?? resolveAdminCredentials();
const describeFlow = credentials ? test.describe : test.describe.skip;

describeFlow("E2E-02 — customer, invoice, PDF, and email UI", () => {
  test.describe.configure({ mode: "serial" });

  const marker = `e2e02-${Date.now()}`;
  let companyId = "";
  let customerId = "";
  let invoiceId = "";

  test("creates a customer through the UI", async ({ page }) => {
    await loginViaUi(page, credentials!);

    const companies = await apiOk<{
      ok: true;
      companies: Array<{ id: string; displayName: string }>;
    }>(page, "/api/companies");
    expect(companies.companies.length).toBeGreaterThan(0);
    companyId = companies.companies[0]!.id;

    await page.goto("/customers/new");
    await page.getByLabel("Display name").fill(`E2E Customer ${marker}`);
    await page.getByLabel("Customer type").selectOption("BUSINESS");
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: /create customer/i }).click();
    await expect(page.getByText(/created|saved/i)).toBeVisible({ timeout: 20_000 });

    const customers = await apiOk<{
      ok: true;
      customers: Array<{ id: string; displayName: string }>;
    }>(page, `/api/customers?companyId=${companyId}`);
    const created = customers.customers.find((row) => row.displayName.includes(marker));
    expect(created).toBeTruthy();
    customerId = created!.id;
  });

  test("creates and issues a draft invoice", async ({ page }) => {
    await loginViaUi(page, credentials!);

    const currencies = await apiOk<{
      ok: true;
      currencies: Array<{ id: string; code: string }>;
    }>(page, "/api/currencies");
    const gbp = currencies.currencies.find((row) => row.code === "GBP");
    expect(gbp).toBeTruthy();

    const draft = await apiOk<{ ok: true; invoice: { id: string } }>(page, "/api/invoices", {
      method: "POST",
      body: {
        companyId,
        customerId,
        invoiceDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date().toISOString().slice(0, 10),
        currencyCode: "GBP",
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
        items: [
          {
            description: `E2E line ${marker}`,
            quantity: "1",
            unitRate: "100.00",
            taxRatePercent: "0",
          },
        ],
      },
    });

    await apiOk(page, `/api/invoices/${invoiceId}/issue`, { method: "POST", body: {} });

    await page.goto(`/invoices/${invoiceId}`);
    await expect(page.getByText(/issued|paid|outstanding/i).first()).toBeVisible();
  });

  test("generates PDF and opens email panel", async ({ page }) => {
    await loginViaUi(page, credentials!);
    await page.goto(`/invoices/${invoiceId}`);

    const generatePdf = page.getByRole("button", { name: /generate pdf|regenerate pdf/i });
    if (await generatePdf.isVisible()) {
      await generatePdf.click();
      await expect(page.getByTestId("invoice-pdf-download")).toBeVisible({ timeout: 30_000 });
    } else {
      await expect(page.getByTestId("invoice-pdf-download")).toBeVisible({ timeout: 15_000 });
    }

    await page.getByTestId("invoice-email-open").click();
    await expect(page.getByTestId("invoice-email-send")).toBeVisible();
    await expect(page.getByTestId("invoice-email-subject")).not.toHaveValue("");
  });
});

test.describe("E2E-02 credential note", () => {
  test("documents staff credential requirement", () => {
    if (!hasStaffCredentials() && hasAdminCredentials()) {
      test.info().annotations.push({
        type: "delegated-role",
        description:
          "E2E-02 ran with admin credentials; set E2E_STAFF_EMAIL/PASSWORD for Staff-only path.",
      });
    }
  });
});

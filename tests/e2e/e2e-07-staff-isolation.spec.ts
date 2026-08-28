import { expect, test } from "@playwright/test";

import { loginViaUi } from "./fixtures/auth";
import { apiJson } from "./fixtures/api-client";
import {
  hasAdminCredentials,
  hasStaffCredentials,
  resolveAdminCredentials,
  resolveStaffCredentials,
} from "./fixtures/credentials";

const describeIsolation =
  hasAdminCredentials() && hasStaffCredentials() ? test.describe : test.describe.skip;

describeIsolation("E2E-07 — staff denied unassigned company data", () => {
  test.describe.configure({ mode: "serial" });

  let foreignCompanyId = "";

  test("admin creates a company not assigned to the staff user", async ({ page }) => {
    const admin = resolveAdminCredentials()!;
    await loginViaUi(page, admin);

    const marker = `e2e07-${Date.now()}`;
    const created = await page.request.post(
      `${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/api/companies`,
      {
        data: {
          displayName: `Foreign ${marker}`,
          legalName: "",
          email: `foreign-${marker}@example.com`,
          phone: "",
          website: "",
          registrationTaxNumber: "",
          addressLine1: "1 Foreign Street",
          addressLine2: "",
          city: "London",
          region: "",
          postalCode: "",
          countryCode: "GB",
          status: "ACTIVE",
        },
      },
    );
    const body = (await created.json()) as { ok: boolean; company?: { id: string } };
    expect(body.ok).toBe(true);
    foreignCompanyId = body.company!.id;
  });

  test("staff receives 403 for foreign company API reads", async ({ page }) => {
    const staff = resolveStaffCredentials()!;
    await loginViaUi(page, staff);

    const { response, json } = await apiJson<{ ok: boolean; error?: string }>(
      page,
      `/api/companies/${foreignCompanyId}`,
    );
    expect(response.status()).toBe(403);
    expect(json.ok).toBe(false);

    const customers = await apiJson<{ ok: boolean }>(
      page,
      `/api/customers?companyId=${foreignCompanyId}`,
    );
    expect(customers.response.status()).toBe(403);
    expect(customers.json.ok).toBe(false);
  });

  test("staff UI does not expose the foreign company in the switcher", async ({ page }) => {
    const staff = resolveStaffCredentials()!;
    await loginViaUi(page, staff);

    const switcher = page.getByTestId("company-switcher");
    if (await switcher.isVisible()) {
      const options = await switcher.locator("option").allTextContents();
      expect(options.join(" ")).not.toContain(foreignCompanyId);
    }

    await page.goto(`/companies/${foreignCompanyId}`);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});

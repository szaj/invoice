import { expect, test } from "@playwright/test";

import { loginViaUi } from "./fixtures/auth";
import { apiOk } from "./fixtures/api-client";
import { hasAdminCredentials, resolveAdminCredentials } from "./fixtures/credentials";

const describeAdmin = hasAdminCredentials() ? test.describe : test.describe.skip;

describeAdmin("E2E-01 — admin company and gateway setup", () => {
  test.describe.configure({ mode: "serial" });

  const marker = `e2e01-${Date.now()}`;
  let companyId = "";

  test("creates a company through the UI", async ({ page }) => {
    const admin = resolveAdminCredentials()!;
    await loginViaUi(page, admin);

    await page.goto("/companies/new");
    await page.getByLabel("Display name").fill(`E2E Co ${marker}`);
    await page.getByLabel("Email").fill(`billing-${marker}@example.com`);
    await page.getByLabel("Address line 1").fill("1 Test Street");
    await page.getByLabel("City").fill("London");
    await page.getByLabel("Country").selectOption("GB");
    await page.getByRole("button", { name: "Create company" }).click();

    await expect(page.getByText(/saved|created/i)).toBeVisible({ timeout: 15_000 });

    const list = await apiOk<{ ok: true; companies: Array<{ id: string; displayName: string }> }>(
      page,
      "/api/companies",
    );
    const created = list.companies.find((row) => row.displayName.includes(marker));
    expect(created).toBeTruthy();
    companyId = created!.id;
  });

  test("enables GBP invoice currency and USD settlement via API", async ({ page }) => {
    const admin = resolveAdminCredentials()!;
    await loginViaUi(page, admin);

    const currencies = await apiOk<{
      ok: true;
      currencies: Array<{ id: string; code: string }>;
    }>(page, "/api/currencies");
    const gbp = currencies.currencies.find((row) => row.code === "GBP");
    expect(gbp).toBeTruthy();

    await apiOk(page, `/api/companies/${companyId}/currencies`, {
      method: "PATCH",
      body: {
        enabledCurrencyIds: [gbp!.id],
        defaultCurrencyId: gbp!.id,
      },
    });

    await apiOk(page, `/api/companies/${companyId}/settlement/MANUAL`, {
      method: "PATCH",
      body: {
        methodEnabled: true,
        enabledSettlementCurrencyCodes: ["USD"],
      },
    });

    const config = await apiOk<{
      ok: true;
      currencies: { enabledCurrencyIds: string[]; defaultCurrencyId: string | null };
    }>(page, `/api/companies/${companyId}/currencies`);
    expect(config.currencies.enabledCurrencyIds).toContain(gbp!.id);
    expect(config.currencies.defaultCurrencyId).toBe(gbp!.id);
  });

  test("enables Stripe gateway for the company", async ({ page }) => {
    const admin = resolveAdminCredentials()!;
    await loginViaUi(page, admin);

    await page.goto(`/companies/${companyId}/gateways`);
    const stripePanel = page.locator("form").filter({ hasText: "Stripe" });
    await stripePanel.getByLabel("Method enabled").check();
    await stripePanel.getByRole("button", { name: "Save configuration" }).click();
    await expect(stripePanel.getByText(/saved|configuration saved/i)).toBeVisible({
      timeout: 15_000,
    });

    const gateways = await apiOk<{
      ok: true;
      configuration: { methods: Array<{ methodCode: string; methodEnabled: boolean }> };
    }>(page, `/api/companies/${companyId}/gateways`);
    const stripe = gateways.configuration.methods.find((row) => row.methodCode === "STRIPE");
    expect(stripe?.methodEnabled).toBe(true);
  });

  test("creates a staff user assigned to the company", async ({ page }) => {
    const admin = resolveAdminCredentials()!;
    await loginViaUi(page, admin);

    const staffEmail = `e2e-staff-${marker}@example.com`;
    await page.goto("/users/new");
    await page.getByLabel("Full name").fill(`E2E Staff ${marker}`);
    await page.getByLabel("Email").fill(staffEmail);
    await page.getByLabel("Role").selectOption("STAFF");
    await page.getByRole("checkbox", { name: `E2E Co ${marker}` }).check();
    await page.getByRole("button", { name: /create user/i }).click();

    await expect(page.getByText(/created|saved|recovery/i)).toBeVisible({ timeout: 20_000 });

    const users = await apiOk<{
      ok: true;
      users: Array<{ email: string; roleCode: string; companyIds: string[] }>;
    }>(page, "/api/users");
    const staff = users.users.find((row) => row.email === staffEmail);
    expect(staff?.roleCode).toBe("STAFF");
    expect(staff?.companyIds).toContain(companyId);
  });
});

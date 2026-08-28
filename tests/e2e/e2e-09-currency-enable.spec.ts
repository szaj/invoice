import { expect, test } from "@playwright/test";

import { loginViaUi } from "./fixtures/auth";
import { apiOk } from "./fixtures/api-client";
import { hasAdminCredentials, resolveAdminCredentials } from "./fixtures/credentials";

const describeAdmin = hasAdminCredentials() ? test.describe : test.describe.skip;

describeAdmin("E2E-09 — global currency enablement is company-scoped", () => {
  test.describe.configure({ mode: "serial" });

  const code = `T${String(Date.now()).slice(-2)}`;
  let currencyId = "";
  let enabledCompanyId = "";
  let otherCompanyId = "";

  test("admin creates a new global currency", async ({ page }) => {
    const admin = resolveAdminCredentials()!;
    await loginViaUi(page, admin);

    await page.goto("/settings/currencies/new");
    await page.getByLabel("Code").fill(code);
    await page.getByLabel("Name").fill(`E2E ${code}`);
    await page.getByLabel("Symbol").fill(code);
    await page.getByLabel("Decimal precision").fill("2");
    await page.getByRole("button", { name: /create currency/i }).click();
    await expect(page.getByText(/saved|created/i)).toBeVisible({ timeout: 15_000 });

    const catalog = await apiOk<{
      ok: true;
      currencies: Array<{ id: string; code: string }>;
    }>(page, "/api/currencies");
    const created = catalog.currencies.find((row) => row.code === code);
    expect(created).toBeTruthy();
    currencyId = created!.id;
  });

  test("enables the currency for one company only", async ({ page }) => {
    const admin = resolveAdminCredentials()!;
    await loginViaUi(page, admin);

    const companies = await apiOk<{ ok: true; companies: Array<{ id: string }> }>(
      page,
      "/api/companies",
    );
    expect(companies.companies.length).toBeGreaterThan(1);
    enabledCompanyId = companies.companies[0]!.id;
    otherCompanyId = companies.companies[1]!.id;

    const enabledConfig = await apiOk<{
      ok: true;
      currencies: {
        enabledCurrencyIds: string[];
        currencies: Array<{ currencyId: string; enabled: boolean }>;
      };
    }>(page, `/api/companies/${enabledCompanyId}/currencies`);

    const nextEnabled = [
      ...enabledConfig.currencies.enabledCurrencyIds.filter((id) => id !== currencyId),
      currencyId,
    ];
    await apiOk(page, `/api/companies/${enabledCompanyId}/currencies`, {
      method: "PATCH",
      body: {
        enabledCurrencyIds: nextEnabled,
        defaultCurrencyId: enabledConfig.currencies.enabledCurrencyIds[0] ?? currencyId,
      },
    });

    const otherConfig = await apiOk<{
      ok: true;
      currencies: { currencies: Array<{ currencyId: string; enabled: boolean }> };
    }>(page, `/api/companies/${otherCompanyId}/currencies`);
    const otherRow = otherConfig.currencies.currencies.find((row) => row.currencyId === currencyId);
    expect(otherRow?.enabled ?? false).toBe(false);
  });
});

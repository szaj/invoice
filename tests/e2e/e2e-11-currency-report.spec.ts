import { expect, test } from "@playwright/test";

import { loginViaUi } from "./fixtures/auth";
import { hasAdminCredentials, resolveAdminCredentials } from "./fixtures/credentials";

const describeAdmin = hasAdminCredentials() ? test.describe : test.describe.skip;

describeAdmin("E2E-11 — currency report with stored snapshots", () => {
  test("renders separate invoice and settlement currency sections", async ({ page }) => {
    const admin = resolveAdminCredentials()!;
    await loginViaUi(page, admin);

    await page.goto("/reports/currencies");
    await expect(page.getByRole("heading", { name: /currency report/i })).toBeVisible();
    await expect(page.getByTestId("currency-report")).toBeVisible();
    await expect(page.getByTestId("currency-report-invoice-totals")).toBeVisible();
    await expect(page.getByTestId("currency-report-settlement-totals")).toBeVisible();
  });
});

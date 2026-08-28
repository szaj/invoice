import { expect, test } from "@playwright/test";

import { loginViaUi } from "./fixtures/auth";
import { hasAdminCredentials, resolveAdminCredentials } from "./fixtures/credentials";

const describeAdmin = hasAdminCredentials() ? test.describe : test.describe.skip;

describeAdmin("E2E-17 — reporting-group monthly brand matrix", () => {
  test("shows month rows, brand columns, CB/RF, and annual summary", async ({ page }) => {
    const admin = resolveAdminCredentials()!;
    await loginViaUi(page, admin);

    const year = new Date().getFullYear();
    await page.goto(`/reports/monthly-brand?year=${year}`);
    await expect(page.getByTestId("monthly-brand-matrix-report")).toBeVisible();
    await expect(page.getByText(/annual summary/i)).toBeVisible();
    await expect(page.getByText(/annual cb\/rf/i)).toBeVisible();
    await expect(page.getByText(/net g\.total/i)).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Month" })).toBeVisible();
  });
});

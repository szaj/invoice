import { expect, test } from "@playwright/test";

import { loginViaUi, logoutViaUi } from "./fixtures/auth";
import { hasAdminCredentials, resolveAdminCredentials } from "./fixtures/credentials";

test("E2E shell — unauthenticated visitors are sent to login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText(/sign up/i)).toHaveCount(0);
});

const describeLiveAuth = hasAdminCredentials() ? test.describe : test.describe.skip;

describeLiveAuth("E2E shell — live password login", () => {
  test("signs in and out with provisioned credentials", async ({ page }) => {
    const credentials = resolveAdminCredentials()!;
    await loginViaUi(page, credentials);
    await logoutViaUi(page);
  });
});

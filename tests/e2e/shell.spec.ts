import { expect, test } from "@playwright/test";

test("unauthenticated visitors are sent to login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText(/sign up/i)).toHaveCount(0);
});

const authEmail = process.env.AUTH_TEST_EMAIL;
const authPassword = process.env.AUTH_TEST_PASSWORD;
const describeLiveAuth = authEmail && authPassword ? test.describe : test.describe.skip;

describeLiveAuth("live password login", () => {
  test("signs in and out with provisioned credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(authEmail ?? "");
    await page.getByLabel("Password").fill(authPassword ?? "");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";

test("application shell boots", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Application shell")).toBeVisible();
});

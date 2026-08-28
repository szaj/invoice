import { expect, test } from "@playwright/test";

import { e2eBaseUrl } from "./fixtures/api-client";

test.describe("E2E-10 — webhook idempotency (hybrid)", () => {
  test("rejects unsigned Stripe webhook at the public route", async ({ request }) => {
    const companyId = "00000000-0000-4000-8000-000000000001";
    const response = await request.post(`${e2eBaseUrl()}/api/webhooks/stripe/${companyId}`, {
      data: "{}",
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test("rejects unsigned PayPal webhook at the public route", async ({ request }) => {
    const companyId = "00000000-0000-4000-8000-000000000001";
    const response = await request.post(`${e2eBaseUrl()}/api/webhooks/paypal/${companyId}`, {
      data: "{}",
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

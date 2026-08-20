import { describe, expect, it } from "vitest";

import { loadEnv } from "@/config/env";

describe("loadEnv", () => {
  it("applies local defaults when optional integrations are unset", () => {
    const env = loadEnv({
      NODE_ENV: "test",
    });

    expect(env.NODE_ENV).toBe("test");
    expect(env.APP_ENV).toBe("local");
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.STRIPE_SECRET_KEY).toBeUndefined();
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.REDIS_URL).toBeUndefined();
    expect(env.SENTRY_DSN).toBeUndefined();
    expect(env.APP_URL).toBeUndefined();
  });

  it("treats blank optional secrets as unset", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      APP_ENV: "development",
      DATABASE_URL: "   ",
      STRIPE_SECRET_KEY: "",
    });

    expect(env.APP_ENV).toBe("development");
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.STRIPE_SECRET_KEY).toBeUndefined();
  });

  it("rejects an invalid APP_ENV", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "test",
        APP_ENV: "qa",
      }),
    ).toThrow(/Invalid environment configuration/);
  });

  it("accepts a valid optional URL when provided", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    });

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
  });

  it("accepts APP_URL and requires it outside local via requireApplicationBaseUrl", async () => {
    const { loadEnv, requireApplicationBaseUrl } = await import("@/config/env");

    expect(requireApplicationBaseUrl(loadEnv({ NODE_ENV: "test" }))).toBe("http://localhost:3000");
    expect(
      requireApplicationBaseUrl(
        loadEnv({
          NODE_ENV: "test",
          APP_ENV: "production",
          APP_URL: "https://invoices.example.com/",
        }),
      ),
    ).toBe("https://invoices.example.com");
    expect(() =>
      requireApplicationBaseUrl(
        loadEnv({
          NODE_ENV: "test",
          APP_ENV: "production",
        }),
      ),
    ).toThrow(/APP_URL is required/);
  });
});

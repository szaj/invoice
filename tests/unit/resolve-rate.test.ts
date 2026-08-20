import { describe, expect, it } from "vitest";

import { selectEffectiveRate } from "@/domain/fixed-rates/resolve-rate";
import {
  FIXED_RATE_MISSING_FOR_CONVERSION,
  SAME_CURRENCY_FIXED_RATE,
  type FixedConversionRateRecord,
} from "@/domain/fixed-rates/types";
import { resolveFixedConversionRate } from "@/server/fixed-rates/resolve-rate-service";

function rate(
  overrides: Partial<FixedConversionRateRecord> &
    Pick<
      FixedConversionRateRecord,
      "id" | "fixedRate" | "versionNo" | "validFrom" | "validTo" | "status"
    >,
): FixedConversionRateRecord {
  return {
    fromCurrency: "USD",
    toCurrency: "AED",
    frequencyLabel: "MANUAL",
    notes: null,
    createdByUserId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

const v1 = rate({
  id: "rate-v1",
  fixedRate: "3.670000000000",
  versionNo: 1,
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
  validTo: new Date("2026-07-01T00:00:00.000Z"),
  status: "EXPIRED",
  frequencyLabel: "YEARLY",
});

const v2 = rate({
  id: "rate-v2",
  fixedRate: "3.680000000000",
  versionNo: 2,
  validFrom: new Date("2026-07-01T00:00:00.000Z"),
  validTo: null,
  status: "ACTIVE",
  frequencyLabel: "MONTHLY",
});

const scheduled = rate({
  id: "rate-scheduled",
  fixedRate: "3.690000000000",
  versionNo: 3,
  validFrom: new Date("2026-12-01T00:00:00.000Z"),
  validTo: null,
  status: "ACTIVE",
  frequencyLabel: "MANUAL",
});

describe("selectEffectiveRate", () => {
  it("returns same-currency rate 1.000000000000 without a catalog row", () => {
    const result = selectEffectiveRate([], "usd", "USD", new Date("2026-06-15T00:00:00.000Z"));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.fixedRate).toBe(SAME_CURRENCY_FIXED_RATE);
    expect(result.rateSource).toBe("same_currency");
    expect(result.rateVersionId).toBeNull();
  });

  it("selects the current ACTIVE rate at/after activation", () => {
    const result = selectEffectiveRate(
      [v1, v2],
      "USD",
      "AED",
      new Date("2026-07-01T00:00:00.000Z"),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.rateVersionId).toBe("rate-v2");
    expect(result.fixedRate).toBe("3.680000000000");
    expect(result.rateSource).toBe("admin_fixed_rate");
  });

  it("selects an EXPIRED version inside its historical window (mid-period change)", () => {
    const before = selectEffectiveRate(
      [v1, v2],
      "USD",
      "AED",
      new Date("2026-06-30T23:59:59.999Z"),
    );
    expect(before.ok).toBe(true);
    if (!before.ok) {
      throw new Error("expected success");
    }
    expect(before.rateVersionId).toBe("rate-v1");
    expect(before.fixedRate).toBe("3.670000000000");
    expect(before.status).toBe("EXPIRED");
  });

  it("does not select a scheduled rate before its validFrom", () => {
    const before = selectEffectiveRate(
      [v2, scheduled],
      "USD",
      "AED",
      new Date("2026-11-15T00:00:00.000Z"),
    );
    expect(before.ok).toBe(true);
    if (!before.ok) {
      throw new Error("expected success");
    }
    expect(before.rateVersionId).toBe("rate-v2");

    const after = selectEffectiveRate(
      [v2, scheduled],
      "USD",
      "AED",
      new Date("2026-12-01T00:00:00.000Z"),
    );
    expect(after.ok).toBe(true);
    if (!after.ok) {
      throw new Error("expected success");
    }
    expect(after.rateVersionId).toBe("rate-scheduled");
    expect(after.fixedRate).toBe("3.690000000000");
  });

  it("blocks conversion when no Admin rate covers the timestamp (never market FX)", () => {
    const missing = selectEffectiveRate([v2], "USD", "AED", new Date("2025-12-01T00:00:00.000Z"));
    expect(missing.ok).toBe(false);
    if (missing.ok) {
      throw new Error("expected failure");
    }
    expect(missing.error).toBe(FIXED_RATE_MISSING_FOR_CONVERSION);
    expect(missing.error.toLowerCase()).toContain("admin");
    expect(missing.error.toLowerCase()).toContain("market");
  });
});

describe("resolveFixedConversionRate", () => {
  it("loads pair versions then applies domain selection", async () => {
    const result = await resolveFixedConversionRate(
      "USD",
      "AED",
      new Date("2026-03-01T00:00:00.000Z"),
      {
        store: {
          async listRatesForPair() {
            return [v1, v2];
          },
        },
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.fixedRate).toBe("3.670000000000");
  });
});

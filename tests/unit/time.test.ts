import { describe, expect, it } from "vitest";

import { parseUtcIsoString, toUtcIsoString } from "@/lib/time";

describe("UTC timestamps", () => {
  it("serializes dates as ISO-8601 UTC", () => {
    const date = new Date("2026-08-20T13:35:00.000Z");

    expect(toUtcIsoString(date)).toBe("2026-08-20T13:35:00.000Z");
  });

  it("parses UTC ISO strings", () => {
    const date = parseUtcIsoString("2026-08-20T13:35:00.000Z");

    expect(date.toISOString()).toBe("2026-08-20T13:35:00.000Z");
  });

  it("rejects invalid timestamps", () => {
    expect(() => parseUtcIsoString("not-a-date")).toThrow("Invalid UTC timestamp");
  });
});

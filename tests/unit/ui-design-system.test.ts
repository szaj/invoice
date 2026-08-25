import { describe, expect, it } from "vitest";

import { STATUS_TONES } from "@/components/data/status-badge";
import { isNavItemActive } from "@/components/layout/nav-config";

describe("UI design system helpers", () => {
  it("maps canonical statuses to tones", () => {
    expect(STATUS_TONES.ACTIVE).toBe("success");
    expect(STATUS_TONES.INACTIVE).toBe("muted");
    expect(STATUS_TONES.DRAFT).toBe("neutral");
    expect(STATUS_TONES.ISSUED).toBe("info");
    expect(STATUS_TONES.OVERDUE).toBe("warning");
    expect(STATUS_TONES.CANCELLED).toBe("destructive");
    expect(STATUS_TONES.PAID).toBe("success");
    expect(STATUS_TONES.PARTIALLY_PAID).toBe("warning");
    expect(STATUS_TONES.PENDING).toBe("warning");
    expect(STATUS_TONES.FAILED).toBe("destructive");
    expect(STATUS_TONES.SUCCESSFUL).toBe("success");
  });

  it("resolves active navigation paths", () => {
    expect(isNavItemActive("/", "/")).toBe(true);
    expect(isNavItemActive("/customers", "/")).toBe(false);
    expect(isNavItemActive("/customers", "/customers")).toBe(true);
    expect(isNavItemActive("/customers/abc", "/customers")).toBe(true);
    expect(isNavItemActive("/invoices", "/customers")).toBe(false);
    const paymentNav = ["/payments", "/payments/manual"] as const;
    expect(isNavItemActive("/payments", "/payments", paymentNav)).toBe(true);
    expect(isNavItemActive("/payments/manual", "/payments", paymentNav)).toBe(false);
    expect(isNavItemActive("/payments/manual", "/payments/manual", paymentNav)).toBe(true);
    expect(
      isNavItemActive("/payments/11111111-1111-4111-8111-111111111111", "/payments", paymentNav),
    ).toBe(true);
    expect(
      isNavItemActive(
        "/payments/11111111-1111-4111-8111-111111111111",
        "/payments/manual",
        paymentNav,
      ),
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  adjustmentFinancialImpact,
  paymentAdjustmentAvailableActions,
  paymentAdjustmentLifecycleBadges,
} from "@/domain/payments/adjustments";

describe("payment adjustment UI helpers (TASK-069)", () => {
  it("labels open dispute as informational (no financial deduction)", () => {
    expect(adjustmentFinancialImpact({ type: "DISPUTE", status: "OPEN" })).toEqual({
      kind: "informational",
      label: "Informational dispute — no financial deduction until debit/refund",
    });
  });

  it("labels processed refund and chargeback debit as financial debit", () => {
    expect(adjustmentFinancialImpact({ type: "REFUND", status: "PROCESSED" }).kind).toBe("debit");
    expect(adjustmentFinancialImpact({ type: "CHARGEBACK", status: "DEBITED" }).kind).toBe("debit");
  });

  it("labels won/reversal as financial credit and cancelled as excluded", () => {
    expect(adjustmentFinancialImpact({ type: "REVERSAL", status: "WON" }).kind).toBe("credit");
    expect(adjustmentFinancialImpact({ type: "REFUND", status: "CANCELLED" }).kind).toBe(
      "cancelled",
    );
  });

  it("derives lifecycle badges without implying SUCCESSFUL was rewritten", () => {
    expect(
      paymentAdjustmentLifecycleBadges([
        { type: "DISPUTE", status: "OPEN" },
        { type: "REFUND", status: "PROCESSED" },
        { type: "CHARGEBACK", status: "DEBITED" },
      ]),
    ).toEqual({
      dispute: "DISPUTED",
      refund: "REFUNDED",
      chargeback: "CHARGEBACK_DEBITED",
    });
  });

  it("offers chargeback won only after debit and hides full refund after any processed refund", () => {
    expect(paymentAdjustmentAvailableActions("SUCCESSFUL", [])).toMatchObject({
      dispute: true,
      fullRefund: true,
      partialRefund: true,
      chargebackDebit: true,
      chargebackWon: false,
      note: true,
    });

    expect(
      paymentAdjustmentAvailableActions("SUCCESSFUL", [
        { type: "REFUND", status: "PROCESSED" },
        { type: "CHARGEBACK", status: "LOST" },
      ]),
    ).toMatchObject({
      fullRefund: false,
      chargebackDebit: false,
      chargebackWon: true,
    });

    expect(paymentAdjustmentAvailableActions("PENDING", []).dispute).toBe(false);
  });
});

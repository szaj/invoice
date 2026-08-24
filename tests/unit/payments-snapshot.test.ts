import { describe, expect, it } from "vitest";

import {
  confirmSnapshotLock,
  isConversionSnapshotComplete,
  isCrossCurrencyPayment,
  snapshotRateEffectiveAt,
} from "@/domain/payments/snapshot";
import type { PaymentRecord } from "@/domain/payments/types";

const paymentDate = new Date("2026-01-15T00:00:00.000Z");
const validFrom = new Date("2026-01-01T00:00:00.000Z");

function payment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    companyId: "11111111-1111-4111-8111-111111111111",
    invoiceId: "22222222-2222-4222-8222-222222222222",
    customerId: "33333333-3333-4333-8333-333333333333",
    methodCode: "MANUAL",
    externalTransactionId: null,
    status: "PENDING",
    invoiceCurrencyCode: "GBP",
    invoiceAmountApplied: "100",
    settlementCurrencyCode: "USD",
    fixedConversionRate: "1.25",
    rateVersionId: "99999999-9999-4999-8999-999999999999",
    rateSource: "ADMIN_FIXED_RATE",
    rateEffectiveAt: validFrom,
    convertedSettlementAmount: "125",
    processorFeeAmount: "9.99",
    actualReceivedAmount: null,
    paymentDate,
    receivedAt: null,
    source: "MANUAL",
    notes: null,
    createdByUserId: null,
    confirmedByUserId: null,
    createdAt: paymentDate,
    updatedAt: paymentDate,
    ...overrides,
  };
}

describe("payment conversion snapshot helpers (TASK-046)", () => {
  it("treats same-currency as not cross-currency and uses payment date as effective time", () => {
    const same = payment({
      invoiceCurrencyCode: "USD",
      settlementCurrencyCode: "usd",
      rateSource: "SAME_CURRENCY",
      rateVersionId: null,
      rateEffectiveAt: paymentDate,
      fixedConversionRate: "1",
      convertedSettlementAmount: "100",
    });
    expect(isCrossCurrencyPayment(same)).toBe(false);
    expect(isConversionSnapshotComplete(same)).toBe(true);
    expect(
      snapshotRateEffectiveAt({
        rateSource: "SAME_CURRENCY",
        paymentDate,
        rateValidFrom: null,
      }).toISOString(),
    ).toBe(paymentDate.toISOString());
  });

  it("uses the Admin rate version validFrom for cross-currency snapshots", () => {
    expect(isCrossCurrencyPayment(payment())).toBe(true);
    expect(isConversionSnapshotComplete(payment())).toBe(true);
    expect(
      snapshotRateEffectiveAt({
        rateSource: "ADMIN_FIXED_RATE",
        paymentDate,
        rateValidFrom: validFrom,
      }).toISOString(),
    ).toBe(validFrom.toISOString());
  });

  it("does not replace a stored rate version or effective time when completing the lock", () => {
    const stored = payment();
    const fill = confirmSnapshotLock(stored, {
      rateEffectiveAt: new Date("2026-07-01T00:00:00.000Z"),
      rateVersionId: "88888888-8888-4888-8888-888888888888",
    });
    expect(fill.rateVersionId).toBe(stored.rateVersionId);
    expect(fill.rateEffectiveAt.toISOString()).toBe(validFrom.toISOString());
  });

  it("treats a missing effective time as an incomplete snapshot", () => {
    expect(isConversionSnapshotComplete(payment({ rateEffectiveAt: null }))).toBe(false);
    expect(
      isConversionSnapshotComplete(
        payment({ rateSource: "ADMIN_FIXED_RATE", rateVersionId: null }),
      ),
    ).toBe(false);
  });
});

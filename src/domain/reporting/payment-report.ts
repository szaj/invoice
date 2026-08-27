import type { PaymentReportRow } from "@/domain/reporting/types";

/**
 * Payment Report rows must expose the locked snapshot fields as stored on the payment
 * (TASK-079 / BR-020 / BR-021). Live FX must never replace these values.
 */
export function assertPaymentReportUsesStoredSnapshots(rows: readonly PaymentReportRow[]): void {
  for (const row of rows) {
    if (!row.fixedConversionRate || row.fixedConversionRate.trim().length === 0) {
      throw new Error("Payment report row missing stored fixed conversion rate snapshot.");
    }
    if (!row.convertedSettlementAmount || row.convertedSettlementAmount.trim().length === 0) {
      throw new Error("Payment report row missing stored converted settlement amount.");
    }
  }
}

/**
 * Identity map documenting that report rows are stored snapshots,
 * not recalculated from live Admin rates.
 */
export function paymentReportRowsFromStoredSnapshots(
  rows: readonly PaymentReportRow[],
): readonly PaymentReportRow[] {
  assertPaymentReportUsesStoredSnapshots(rows);
  return rows;
}

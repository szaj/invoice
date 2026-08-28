/**
 * E2E-01..17 coverage registry (TASK-096).
 * Scenarios from Testing §22.2 — UI flows use Playwright; financial/webhook
 * chains signed off via existing Vitest integration suites where noted.
 */
export type E2eCoverageKind = "playwright" | "integration-delegated" | "hybrid";

export type E2eScenario = {
  readonly id: string;
  readonly title: string;
  readonly kind: E2eCoverageKind;
  readonly spec?: string;
  readonly integrationTests?: readonly string[];
  readonly notes?: string;
};

export const E2E_SCENARIO_IDS = [
  "E2E-01",
  "E2E-02",
  "E2E-03",
  "E2E-04",
  "E2E-05",
  "E2E-06",
  "E2E-07",
  "E2E-08",
  "E2E-09",
  "E2E-10",
  "E2E-11",
  "E2E-12",
  "E2E-13",
  "E2E-14",
  "E2E-15",
  "E2E-16",
  "E2E-17",
] as const;

export type E2eScenarioId = (typeof E2E_SCENARIO_IDS)[number];

export const E2E_SCENARIOS: readonly E2eScenario[] = [
  {
    id: "E2E-01",
    title:
      "Admin creates company, enables GBP invoices and USD settlement, configures Stripe, creates staff access",
    kind: "playwright",
    spec: "e2e-01-admin-setup.spec.ts",
  },
  {
    id: "E2E-02",
    title: "Staff creates customer, creates GBP invoice, generates PDF, emails invoice",
    kind: "playwright",
    spec: "e2e-02-invoice-flow.spec.ts",
    notes: "Requires E2E_STAFF_EMAIL/PASSWORD or falls back to admin for UI smoke.",
  },
  {
    id: "E2E-03",
    title:
      "GBP invoice partially paid through USD; fixed rate snapshot; Partially Paid; fee excluded from conversion",
    kind: "integration-delegated",
    integrationTests: ["tests/integration/payments-partial.test.ts"],
  },
  {
    id: "E2E-04",
    title: "Second payment completes balance; invoice becomes Paid",
    kind: "integration-delegated",
    integrationTests: ["tests/integration/payments-partial.test.ts"],
  },
  {
    id: "E2E-05",
    title: "AUD invoice paid manually into AED settlement; fixed rate applied and locked",
    kind: "integration-delegated",
    integrationTests: ["tests/integration/payments-manual.test.ts"],
  },
  {
    id: "E2E-06",
    title: "Compliance reviews payment/invoice, adds note, approves; events appear in audit log",
    kind: "playwright",
    spec: "e2e-06-compliance-audit.spec.ts",
    notes: "Requires E2E_COMPLIANCE_EMAIL/PASSWORD.",
  },
  {
    id: "E2E-07",
    title: "Staff attempts to access unassigned company data and is denied",
    kind: "playwright",
    spec: "e2e-07-staff-isolation.spec.ts",
    notes: "Requires E2E_STAFF_EMAIL/PASSWORD.",
  },
  {
    id: "E2E-08",
    title:
      "Admin disables PayPal for one company; it disappears from checkout options but old payments remain",
    kind: "playwright",
    spec: "e2e-08-paypal-disable.spec.ts",
  },
  {
    id: "E2E-09",
    title:
      "Admin adds new currency; enables for one company; other companies cannot use it until enabled",
    kind: "playwright",
    spec: "e2e-09-currency-enable.spec.ts",
  },
  {
    id: "E2E-10",
    title: "Duplicate webhook delivery never duplicates confirmed payments",
    kind: "hybrid",
    spec: "e2e-10-webhook-idempotency.spec.ts",
    integrationTests: [
      "tests/unit/webhook-suite.test.ts",
      "tests/integration/webhook-suite.test.ts",
    ],
  },
  {
    id: "E2E-11",
    title:
      "Report shows separate original currencies and correct USD reporting equivalent using stored snapshots",
    kind: "playwright",
    spec: "e2e-11-currency-report.spec.ts",
  },
  {
    id: "E2E-12",
    title: "Issued invoice cancellation requires reason and preserves PDF/audit history",
    kind: "playwright",
    spec: "e2e-12-invoice-cancel.spec.ts",
  },
  {
    id: "E2E-13",
    title:
      "Historical fixed-rate snapshots never recalculate when Admin publishes a later rate version",
    kind: "integration-delegated",
    integrationTests: [
      "tests/integration/payments-snapshot.test.ts",
      "tests/unit/financial-calculation-suite.test.ts",
    ],
  },
  {
    id: "E2E-14",
    title: "Dispute open does not change outstanding, CB/RF, or original payment",
    kind: "integration-delegated",
    integrationTests: ["tests/integration/payments-dispute.test.ts"],
    notes: "Payment adjustment UI covered separately in TASK-069.",
  },
  {
    id: "E2E-15",
    title:
      "Full/partial refund creates linked adjustment; original payment preserved; CB/RF updated",
    kind: "integration-delegated",
    integrationTests: [
      "tests/integration/payments-refund.test.ts",
      "tests/integration/payments-partial-refund.test.ts",
    ],
  },
  {
    id: "E2E-16",
    title: "Chargeback debit then won/reversal restores net CB/RF without editing original records",
    kind: "integration-delegated",
    integrationTests: [
      "tests/integration/payments-chargeback-debit.test.ts",
      "tests/integration/payments-chargeback-won.test.ts",
    ],
  },
  {
    id: "E2E-17",
    title:
      "Yearly reporting-group report shows month rows, brand columns, Monthly Total, CB/RF, G.Total, and annual summary",
    kind: "playwright",
    spec: "e2e-17-reporting-group.spec.ts",
  },
];

export function scenarioById(id: E2eScenarioId): E2eScenario {
  const scenario = E2E_SCENARIOS.find((row) => row.id === id);
  if (!scenario) {
    throw new Error(`Unknown E2E scenario: ${id}`);
  }
  return scenario;
}

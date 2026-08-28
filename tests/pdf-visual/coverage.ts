/**
 * PDF visual QA coverage registry (TASK-097).
 * Representative invoice layouts: brand logo, currency, totals, terms, A4/Letter.
 * Byte snapshots and content assertions live in tests/unit/pdf-visual-suite.test.ts.
 */
export type PdfVisualCoverageKind = "render-snapshot" | "source-boundary";

export type PdfVisualScenarioMeta = {
  readonly id: string;
  readonly title: string;
  readonly kind: PdfVisualCoverageKind;
  readonly pageSize: "A4" | "LETTER";
  readonly currencyCode: string;
  readonly hasLogo: boolean;
  readonly hasTerms: boolean;
  readonly unitTest: string;
  readonly notes?: string;
};

export const PDF_VQA_SCENARIO_IDS = [
  "PDF-VQA-01",
  "PDF-VQA-02",
  "PDF-VQA-03",
  "PDF-VQA-04",
] as const;

export type PdfVisualScenarioId = (typeof PDF_VQA_SCENARIO_IDS)[number];

export const PDF_VQA_SCENARIOS: readonly PdfVisualScenarioMeta[] = [
  {
    id: "PDF-VQA-01",
    title: "Minimal brand, USD totals, A4",
    kind: "render-snapshot",
    pageSize: "A4",
    currencyCode: "USD",
    hasLogo: false,
    hasTerms: false,
    unitTest: "tests/unit/pdf-visual-suite.test.ts",
    notes: "Subtotal, paid, balance due; customer notes; no logo or terms block.",
  },
  {
    id: "PDF-VQA-02",
    title: "Brand logo, GBP currency, terms, Letter",
    kind: "render-snapshot",
    pageSize: "LETTER",
    currencyCode: "GBP",
    hasLogo: true,
    hasTerms: true,
    unitTest: "tests/unit/pdf-visual-suite.test.ts",
    notes: "Full company/customer address blocks; logo data URI; terms and conditions footer.",
  },
  {
    id: "PDF-VQA-03",
    title: "Multi-line tax totals, EUR, A4",
    kind: "render-snapshot",
    pageSize: "A4",
    currencyCode: "EUR",
    hasLogo: false,
    hasTerms: true,
    unitTest: "tests/unit/pdf-visual-suite.test.ts",
    notes: "Multiple line items with VAT; paid-in-full totals.",
  },
  {
    id: "PDF-VQA-04",
    title: "Full brand block, AED currency, Letter",
    kind: "render-snapshot",
    pageSize: "LETTER",
    currencyCode: "AED",
    hasLogo: true,
    hasTerms: true,
    unitTest: "tests/unit/pdf-visual-suite.test.ts",
    notes: "Partial payment totals; Gulf region branding; logo + terms.",
  },
];

export const PDF_VQA_SOURCE_BOUNDARY: readonly PdfVisualScenarioMeta[] = [
  {
    id: "PDF-VQA-05",
    title: "Internal notes never rendered on PDF",
    kind: "source-boundary",
    pageSize: "A4",
    currencyCode: "N/A",
    hasLogo: false,
    hasTerms: false,
    unitTest: "tests/unit/pdf-visual-suite.test.ts",
    notes: "Render model omits internal notes; document source excludes internalNotes field.",
  },
];

export function allPdfVisualScenarios(): readonly PdfVisualScenarioMeta[] {
  return [...PDF_VQA_SCENARIOS, ...PDF_VQA_SOURCE_BOUNDARY];
}

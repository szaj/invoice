import { existsSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  allPdfVisualScenarios,
  PDF_VQA_SCENARIO_IDS,
  PDF_VQA_SCENARIOS,
} from "../pdf-visual/coverage";

test.describe("PDF visual QA results (TASK-097)", () => {
  test("documents representative layout scenarios PDF-VQA-01..04", () => {
    expect(PDF_VQA_SCENARIOS.map((row) => row.id)).toEqual([...PDF_VQA_SCENARIO_IDS]);
    expect(PDF_VQA_SCENARIOS).toHaveLength(4);
  });

  test("every scenario is signed off via the PDF visual Vitest suite", () => {
    for (const scenario of allPdfVisualScenarios()) {
      const unitPath = path.join(process.cwd(), scenario.unitTest);
      expect(existsSync(unitPath), `${scenario.id} missing ${scenario.unitTest}`).toBe(true);

      test.info().annotations.push({
        type: "pdf-visual-qa",
        description: `${scenario.id}: ${scenario.title} (${scenario.kind}) — ${scenario.notes ?? "see unit suite"}`,
      });
    }
  });

  test("covers brand logo, currency, totals, terms, and page sizes", () => {
    const renderRows = PDF_VQA_SCENARIOS;
    expect(renderRows.some((row) => row.hasLogo)).toBe(true);
    expect(renderRows.some((row) => !row.hasLogo)).toBe(true);
    expect(renderRows.some((row) => row.hasTerms)).toBe(true);
    expect(new Set(renderRows.map((row) => row.pageSize))).toEqual(new Set(["A4", "LETTER"]));
    expect(new Set(renderRows.map((row) => row.currencyCode))).toEqual(
      new Set(["USD", "GBP", "EUR", "AED"]),
    );
  });
});

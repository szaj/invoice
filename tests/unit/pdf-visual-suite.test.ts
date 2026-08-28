import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { InvoicePdfRenderModel } from "@/domain/invoices/pdf";
import { renderInvoicePdfBytes } from "@/server/invoices/invoice-pdf-render";
import {
  assertPdfPageSize,
  PDF_VISUAL_INTERNAL_NOTE,
  PDF_VISUAL_SCENARIOS,
  pdfExtractableText,
  pdfHasEmbeddedLogo,
  scenarioById,
} from "../helpers/pdf-visual-fixtures";
import { allPdfVisualScenarios, PDF_VQA_SCENARIO_IDS } from "../pdf-visual/coverage";

/** Deterministic layout signature — React-pdf bytes include timestamps so we snapshot structure instead. */
function pdfVisualLayoutSignature(model: InvoicePdfRenderModel) {
  return {
    pageSize: model.pageSize,
    versionNo: model.versionNo,
    company: {
      displayName: model.company.displayName,
      hasLogo: model.company.logoDataUri != null,
      hasTerms: model.company.termsAndConditions != null,
      hasAddress: Boolean(model.company.addressLine1 ?? model.company.city),
    },
    customer: model.customer.displayName,
    currencyCode: model.invoice.currencyCode,
    totals: {
      subtotal: model.invoice.subtotal,
      taxTotal: model.invoice.taxTotal,
      invoiceTotal: model.invoice.invoiceTotal,
      confirmedPaidAmount: model.invoice.confirmedPaidAmount,
      outstandingAmount: model.invoice.outstandingAmount,
    },
    lineItems: model.invoice.lineItems.map((item) => ({
      description: item.description,
      lineTotal: item.lineTotal,
      taxRatePercent: item.taxRatePercent,
    })),
    customerNotes: model.invoice.customerNotes,
  } as const;
}

function normalizedPdfTextChecksum(text: string): string {
  const normalized = text
    .replace(/\/CreationDate\s*\([^)]*\)/g, "/CreationDate(stripped)")
    .replace(/\/ModDate\s*\([^)]*\)/g, "/ModDate(stripped)")
    .replace(/\/ID\s*\[[^\]]*\]/g, "/ID[stripped]");
  return createHash("sha256").update(normalized).digest("hex");
}

function uncommented(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

describe("PDF visual QA suite (TASK-097)", () => {
  describe("coverage manifest", () => {
    it("registers PDF-VQA-01 through PDF-VQA-04 render scenarios", () => {
      expect(PDF_VQA_SCENARIO_IDS).toEqual([
        "PDF-VQA-01",
        "PDF-VQA-02",
        "PDF-VQA-03",
        "PDF-VQA-04",
      ]);
      expect(PDF_VISUAL_SCENARIOS.map((row) => row.id)).toEqual([...PDF_VQA_SCENARIO_IDS]);
    });

    it("covers A4 and Letter page sizes", () => {
      const pageSizes = new Set(PDF_VISUAL_SCENARIOS.map((row) => row.pageSize));
      expect(pageSizes.has("A4")).toBe(true);
      expect(pageSizes.has("LETTER")).toBe(true);
    });

    it("covers logo and no-logo brand layouts", () => {
      expect(PDF_VISUAL_SCENARIOS.some((row) => row.hasLogo)).toBe(true);
      expect(PDF_VISUAL_SCENARIOS.some((row) => !row.hasLogo)).toBe(true);
    });

    it("covers terms and currency-labelled totals", () => {
      expect(PDF_VISUAL_SCENARIOS.some((row) => row.hasTerms)).toBe(true);
      for (const scenario of PDF_VISUAL_SCENARIOS) {
        const signature = pdfVisualLayoutSignature(scenario.buildModel());
        expect(signature.currencyCode).toBe(scenario.currencyCode);
        expect(signature.totals).toBeTruthy();
        if (scenario.hasTerms) {
          expect(signature.company.hasTerms).toBe(true);
        }
      }
    });

    it("references an existing unit test file for every manifest row", () => {
      for (const row of allPdfVisualScenarios()) {
        const absolutePath = path.join(process.cwd(), row.unitTest);
        expect(existsSync(absolutePath), `${row.id} → ${row.unitTest}`).toBe(true);
      }
    });
  });

  describe("render snapshots", () => {
    for (const scenario of PDF_VISUAL_SCENARIOS) {
      it(`${scenario.id} — ${scenario.title}`, async () => {
        const model = scenario.buildModel();
        expect(model.pageSize).toBe(scenario.pageSize);
        expect(pdfVisualLayoutSignature(model)).toMatchSnapshot(`${scenario.id} layout`);

        const rendered = await renderInvoicePdfBytes(model);
        expect(rendered.byteSize).toBeGreaterThan(500);
        expect(rendered.checksumSha256).toMatch(/^[a-f0-9]{64}$/);

        const text = pdfExtractableText(rendered.bytes);
        expect(text.startsWith("%PDF")).toBe(true);
        assertPdfPageSize(text, scenario.pageSize);
        expect(pdfHasEmbeddedLogo(text)).toBe(scenario.hasLogo);
        for (const fragment of scenario.metadataMustContain) {
          expect(text, `${scenario.id} metadata must contain "${fragment}"`).toContain(fragment);
        }

        expect(text).not.toContain(PDF_VISUAL_INTERNAL_NOTE);
        expect(Buffer.from(rendered.bytes).includes(Buffer.from(PDF_VISUAL_INTERNAL_NOTE))).toBe(
          false,
        );

        const rerun = await renderInvoicePdfBytes(model);
        expect(normalizedPdfTextChecksum(pdfExtractableText(rerun.bytes))).toBe(
          normalizedPdfTextChecksum(text),
        );
      }, 30_000);
    }
  });

  describe("internal notes boundary (PDF-VQA-05)", () => {
    it("omits internal notes from every representative render model", () => {
      for (const scenario of PDF_VISUAL_SCENARIOS) {
        const serialized = JSON.stringify(scenario.buildModel());
        expect(serialized).not.toContain(PDF_VISUAL_INTERNAL_NOTE);
      }
    });

    it("invoice PDF document source never references internalNotes", () => {
      const documentPath = path.join(
        process.cwd(),
        "src",
        "server",
        "invoices",
        "invoice-pdf-document.tsx",
      );
      const pdfDomainPath = path.join(process.cwd(), "src", "domain", "invoices", "pdf.ts");
      const documentSource = uncommented(readFileSync(documentPath, "utf8"));
      const domainSource = readFileSync(pdfDomainPath, "utf8");

      expect(documentSource).not.toMatch(/\binternalNotes\b/);
      expect(domainSource).toMatch(/Internal notes must never appear on the PDF/);
      expect(domainSource).not.toMatch(/internalNotes:\s*input\.snapshot\.internalNotes/);
    });

    it("rendered bytes exclude internal notes for each scenario", async () => {
      for (const id of PDF_VQA_SCENARIO_IDS) {
        const scenario = scenarioById(id);
        const rendered = await renderInvoicePdfBytes(scenario.buildModel());
        const text = pdfExtractableText(rendered.bytes);
        expect(text).not.toContain(PDF_VISUAL_INTERNAL_NOTE);
      }
    }, 60_000);
  });
});

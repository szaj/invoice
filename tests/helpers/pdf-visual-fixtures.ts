import { buildInvoicePdfRenderModel } from "@/domain/invoices/pdf";
import type { InvoicePdfPageSize, InvoicePdfRenderModel } from "@/domain/invoices/pdf";
import type { InvoiceVersionSnapshot } from "@/domain/invoices/versions";

/** Marker that must never appear in rendered PDF bytes (BR / TASK-097). */
export const PDF_VISUAL_INTERNAL_NOTE = "SECRET_INTERNAL_NOTE_NEVER_PRINT_XYZ";

/** Deterministic 1×1 PNG for logo rendering checks. */
export const PDF_VISUAL_FIXTURE_LOGO_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export type PdfVisualScenario = {
  readonly id: string;
  readonly title: string;
  readonly pageSize: InvoicePdfPageSize;
  readonly currencyCode: string;
  readonly hasLogo: boolean;
  readonly hasTerms: boolean;
  readonly buildModel: () => InvoicePdfRenderModel;
  /** Strings that must appear in extractable PDF metadata (title/author/subject). */
  readonly metadataMustContain: readonly string[];
};

function baseSnapshot(overrides: Partial<InvoiceVersionSnapshot> = {}): InvoiceVersionSnapshot {
  return {
    invoiceId: "inv-pdf-vqa",
    companyId: "co-pdf-vqa",
    customerId: "cu-pdf-vqa",
    invoiceNumber: "VQA-000001",
    invoiceDate: "2026-08-01",
    dueDate: "2026-08-31",
    currencyCode: "USD",
    referencePo: "PO-VQA-1",
    assignedStaffUserId: null,
    status: "ISSUED",
    complianceStatus: "NOT_REVIEWED",
    internalNotes: PDF_VISUAL_INTERNAL_NOTE,
    customerNotes: "Thank you for your business.",
    subtotal: "100.0000",
    discountTotal: "0.0000",
    taxTotal: "0.0000",
    invoiceTotal: "100.0000",
    confirmedPaidAmount: "25.0000",
    outstandingAmount: "75.0000",
    lineItems: [
      {
        sortOrder: 0,
        description: "Consulting services",
        quantity: "1.000000",
        unitRate: "100.0000",
        taxName: null,
        taxRatePercent: null,
        lineTotal: "100.0000",
      },
    ],
    ...overrides,
  };
}

export const PDF_VISUAL_SCENARIOS: readonly PdfVisualScenario[] = [
  {
    id: "PDF-VQA-01",
    title: "Minimal brand, USD totals, A4",
    pageSize: "A4",
    currencyCode: "USD",
    hasLogo: false,
    hasTerms: false,
    metadataMustContain: ["Invoice VQA-000001", "Minimal Brand Co"],
    buildModel: () =>
      buildInvoicePdfRenderModel({
        pageSize: "A4",
        versionNo: 1,
        snapshot: baseSnapshot({ currencyCode: "USD" }),
        company: {
          displayName: "Minimal Brand Co",
          legalName: null,
          email: null,
          phone: null,
          website: null,
          registrationTaxNumber: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          region: null,
          postalCode: null,
          countryCode: null,
          termsAndConditions: null,
          logoDataUri: null,
        },
        customer: {
          displayName: "Sample Customer",
          contactPerson: null,
          email: null,
          phone: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          region: null,
          postalCode: null,
          countryCode: null,
          taxRegistrationId: null,
        },
      }),
  },
  {
    id: "PDF-VQA-02",
    title: "Brand logo, GBP currency, terms, Letter",
    pageSize: "LETTER",
    currencyCode: "GBP",
    hasLogo: true,
    hasTerms: true,
    metadataMustContain: ["Invoice VQA-GBP-002", "Logo Brand Ltd"],
    buildModel: () =>
      buildInvoicePdfRenderModel({
        pageSize: "LETTER",
        versionNo: 2,
        snapshot: baseSnapshot({
          invoiceNumber: "VQA-GBP-002",
          currencyCode: "GBP",
          subtotal: "250.0000",
          taxTotal: "0.0000",
          invoiceTotal: "250.0000",
          confirmedPaidAmount: "0.0000",
          outstandingAmount: "250.0000",
          customerNotes: null,
          lineItems: [
            {
              sortOrder: 0,
              description: "Widget supply",
              quantity: "5.000000",
              unitRate: "50.0000",
              taxName: null,
              taxRatePercent: null,
              lineTotal: "250.0000",
            },
          ],
        }),
        company: {
          displayName: "Logo Brand Ltd",
          legalName: "Logo Brand Limited",
          email: "billing@logobrand.test",
          phone: "+44 20 7946 0958",
          website: "https://logobrand.test",
          registrationTaxNumber: "GB123456789",
          addressLine1: "10 Downing Street",
          addressLine2: null,
          city: "London",
          region: null,
          postalCode: "SW1A 2AA",
          countryCode: "GB",
          termsAndConditions: "Net 30 — payment due on receipt.",
          logoDataUri: PDF_VISUAL_FIXTURE_LOGO_DATA_URI,
        },
        customer: {
          displayName: "UK Buyer PLC",
          contactPerson: "Accounts Payable",
          email: "ap@ukbuyer.test",
          phone: null,
          addressLine1: "221B Baker Street",
          addressLine2: null,
          city: "London",
          region: null,
          postalCode: "NW1 6XE",
          countryCode: "GB",
          taxRegistrationId: "GB987654321",
        },
      }),
  },
  {
    id: "PDF-VQA-03",
    title: "Multi-line tax totals, EUR, A4",
    pageSize: "A4",
    currencyCode: "EUR",
    hasLogo: false,
    hasTerms: true,
    metadataMustContain: ["Invoice VQA-EUR-003", "Euro Services GmbH"],
    buildModel: () =>
      buildInvoicePdfRenderModel({
        pageSize: "A4",
        versionNo: 1,
        snapshot: baseSnapshot({
          invoiceNumber: "VQA-EUR-003",
          currencyCode: "EUR",
          subtotal: "900.0000",
          taxTotal: "180.0000",
          invoiceTotal: "1080.0000",
          confirmedPaidAmount: "1080.0000",
          outstandingAmount: "0.0000",
          referencePo: "PO-EU-99",
          lineItems: [
            {
              sortOrder: 0,
              description: "Implementation",
              quantity: "1.000000",
              unitRate: "600.0000",
              taxName: "VAT",
              taxRatePercent: "20.0000",
              lineTotal: "720.0000",
            },
            {
              sortOrder: 1,
              description: "Support retainer",
              quantity: "3.000000",
              unitRate: "100.0000",
              taxName: "VAT",
              taxRatePercent: "20.0000",
              lineTotal: "360.0000",
            },
          ],
        }),
        company: {
          displayName: "Euro Services GmbH",
          legalName: "Euro Services Gesellschaft mbH",
          email: "finance@euroservices.test",
          phone: null,
          website: null,
          registrationTaxNumber: "DE123456789",
          addressLine1: "Alexanderplatz 1",
          addressLine2: null,
          city: "Berlin",
          region: "BE",
          postalCode: "10178",
          countryCode: "DE",
          termsAndConditions: "Zahlbar innerhalb von 14 Tagen.",
          logoDataUri: null,
        },
        customer: {
          displayName: "EU Client SA",
          contactPerson: null,
          email: "invoices@euclient.test",
          phone: null,
          addressLine1: "Rue de la Loi 16",
          addressLine2: null,
          city: "Brussels",
          region: null,
          postalCode: "1000",
          countryCode: "BE",
          taxRegistrationId: null,
        },
      }),
  },
  {
    id: "PDF-VQA-04",
    title: "Full brand block, AED currency, Letter",
    pageSize: "LETTER",
    currencyCode: "AED",
    hasLogo: true,
    hasTerms: true,
    metadataMustContain: ["Invoice VQA-AED-004", "Gulf Trading LLC"],
    buildModel: () =>
      buildInvoicePdfRenderModel({
        pageSize: "LETTER",
        versionNo: 3,
        snapshot: baseSnapshot({
          invoiceNumber: "VQA-AED-004",
          currencyCode: "AED",
          subtotal: "1500.0000",
          discountTotal: "0.0000",
          taxTotal: "75.0000",
          invoiceTotal: "1575.0000",
          confirmedPaidAmount: "1050.0000",
          outstandingAmount: "525.0000",
          lineItems: [
            {
              sortOrder: 0,
              description: "Professional services bundle",
              quantity: "1.000000",
              unitRate: "1500.0000",
              taxName: "VAT",
              taxRatePercent: "5.0000",
              lineTotal: "1575.0000",
            },
          ],
        }),
        company: {
          displayName: "Gulf Trading LLC",
          legalName: "Gulf Trading Limited Liability Company",
          email: "accounts@gulftrading.test",
          phone: "+971 4 123 4567",
          website: "https://gulftrading.test",
          registrationTaxNumber: "TRN100200300400005",
          addressLine1: "Sheikh Zayed Road",
          addressLine2: "Office 1204",
          city: "Dubai",
          region: "DU",
          postalCode: null,
          countryCode: "AE",
          termsAndConditions: "Payment within 15 days. Late fees may apply.",
          logoDataUri: PDF_VISUAL_FIXTURE_LOGO_DATA_URI,
        },
        customer: {
          displayName: "Regional Partner FZE",
          contactPerson: "Finance Team",
          email: "finance@partner.test",
          phone: "+971 2 555 0100",
          addressLine1: "Khalifa Street",
          addressLine2: null,
          city: "Abu Dhabi",
          region: null,
          postalCode: null,
          countryCode: "AE",
          taxRegistrationId: "TRN500400300200001",
        },
      }),
  },
];

export function scenarioById(id: string): PdfVisualScenario {
  const scenario = PDF_VISUAL_SCENARIOS.find((row) => row.id === id);
  if (!scenario) {
    throw new Error(`Unknown PDF visual scenario: ${id}`);
  }
  return scenario;
}

/** Latin-1 view of PDF bytes for metadata and structural checks. */
export function pdfExtractableText(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

const PDF_PAGE_MEDIA_BOX: Record<InvoicePdfPageSize, string> = {
  A4: "595.280029 841.890015",
  LETTER: "612 792",
};

export function assertPdfPageSize(text: string, pageSize: InvoicePdfPageSize): void {
  if (!text.includes(`/MediaBox [0 0 ${PDF_PAGE_MEDIA_BOX[pageSize]}]`)) {
    throw new Error(`Expected MediaBox for ${pageSize}`);
  }
}

export function pdfHasEmbeddedLogo(text: string): boolean {
  return text.includes("/Subtype /Image") && text.includes("/XObject");
}

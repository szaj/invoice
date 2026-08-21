import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { InvoicePdfRenderModel } from "@/domain/invoices/pdf";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 16,
  },
  brandBlock: {
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: "60%",
  },
  logo: {
    width: 96,
    height: 48,
    objectFit: "contain",
    marginBottom: 8,
  },
  brandName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  muted: {
    color: "#4b5563",
    marginBottom: 2,
  },
  titleBlock: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    marginTop: 12,
  },
  twoCol: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 16,
  },
  col: {
    flexGrow: 1,
    flexBasis: 0,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  metaLabel: {
    width: 88,
    color: "#4b5563",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingBottom: 4,
    marginTop: 8,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 5,
  },
  colDesc: { width: "40%" },
  colQty: { width: "12%", textAlign: "right" },
  colRate: { width: "16%", textAlign: "right" },
  colTax: { width: "16%", textAlign: "right" },
  colTotal: { width: "16%", textAlign: "right" },
  totals: {
    marginTop: 12,
    alignSelf: "flex-end",
    width: 220,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  totalStrong: {
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#111827",
  },
  terms: {
    marginTop: 28,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  notes: {
    marginTop: 16,
  },
});

function formatAddress(parts: Array<string | null | undefined>): string {
  return parts.filter((part) => part && part.trim().length > 0).join(", ");
}

function money(amount: string, currency: string): string {
  return `${currency} ${amount}`;
}

/**
 * Branded invoice PDF document (ADR-013). Does not accept or render internal notes.
 */
export function InvoicePdfDocument({ model }: { readonly model: InvoicePdfRenderModel }) {
  const companyAddress = formatAddress([
    model.company.addressLine1,
    model.company.addressLine2,
    model.company.city,
    model.company.region,
    model.company.postalCode,
    model.company.countryCode,
  ]);
  const customerAddress = formatAddress([
    model.customer.addressLine1,
    model.customer.addressLine2,
    model.customer.city,
    model.customer.region,
    model.customer.postalCode,
    model.customer.countryCode,
  ]);

  return (
    <Document
      title={`Invoice ${model.invoice.invoiceNumber}`}
      author={model.company.displayName}
      subject={`Invoice ${model.invoice.invoiceNumber}`}
    >
      <Page size={model.pageSize} style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.brandBlock}>
            {model.company.logoDataUri ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
              <Image src={model.company.logoDataUri} style={styles.logo} />
            ) : null}
            <Text style={styles.brandName}>{model.company.displayName}</Text>
            {model.company.legalName ? (
              <Text style={styles.muted}>{model.company.legalName}</Text>
            ) : null}
            {companyAddress ? <Text style={styles.muted}>{companyAddress}</Text> : null}
            {model.company.registrationTaxNumber ? (
              <Text style={styles.muted}>Tax ID: {model.company.registrationTaxNumber}</Text>
            ) : null}
            {model.company.email ? <Text style={styles.muted}>{model.company.email}</Text> : null}
            {model.company.phone ? <Text style={styles.muted}>{model.company.phone}</Text> : null}
            {model.company.website ? (
              <Text style={styles.muted}>{model.company.website}</Text>
            ) : null}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>INVOICE</Text>
            <Text>{model.invoice.invoiceNumber}</Text>
            <Text style={styles.muted}>Version {model.versionNo}</Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Bill to</Text>
            <Text>{model.customer.displayName}</Text>
            {model.customer.contactPerson ? (
              <Text style={styles.muted}>{model.customer.contactPerson}</Text>
            ) : null}
            {customerAddress ? <Text style={styles.muted}>{customerAddress}</Text> : null}
            {model.customer.email ? <Text style={styles.muted}>{model.customer.email}</Text> : null}
            {model.customer.phone ? <Text style={styles.muted}>{model.customer.phone}</Text> : null}
            {model.customer.taxRegistrationId ? (
              <Text style={styles.muted}>Tax ID: {model.customer.taxRegistrationId}</Text>
            ) : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice date</Text>
              <Text>{model.invoice.invoiceDate}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Due date</Text>
              <Text>{model.invoice.dueDate}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Currency</Text>
              <Text>{model.invoice.currencyCode}</Text>
            </View>
            {model.invoice.referencePo ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Reference / PO</Text>
                <Text>{model.invoice.referencePo}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Line items</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.colDesc}>Description</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colRate}>Rate</Text>
          <Text style={styles.colTax}>Tax</Text>
          <Text style={styles.colTotal}>Amount</Text>
        </View>
        {model.invoice.lineItems.map((item, index) => (
          <View key={`${item.sortOrder}-${index}`} style={styles.tableRow} wrap={false}>
            <Text style={styles.colDesc}>{item.description}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colRate}>{item.unitRate}</Text>
            <Text style={styles.colTax}>
              {item.taxRatePercent != null
                ? `${item.taxName ?? "Tax"} ${item.taxRatePercent}%`
                : "—"}
            </Text>
            <Text style={styles.colTotal}>{item.lineTotal}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{money(model.invoice.subtotal, model.invoice.currencyCode)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Discount</Text>
            <Text>{money(model.invoice.discountTotal, model.invoice.currencyCode)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Tax</Text>
            <Text>{money(model.invoice.taxTotal, model.invoice.currencyCode)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalStrong]}>
            <Text>Total</Text>
            <Text>{money(model.invoice.invoiceTotal, model.invoice.currencyCode)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Paid</Text>
            <Text>{money(model.invoice.confirmedPaidAmount, model.invoice.currencyCode)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalStrong]}>
            <Text>Balance due</Text>
            <Text>{money(model.invoice.outstandingAmount, model.invoice.currencyCode)}</Text>
          </View>
        </View>

        {model.invoice.customerNotes ? (
          <View style={styles.notes}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text>{model.invoice.customerNotes}</Text>
          </View>
        ) : null}

        {model.company.termsAndConditions ? (
          <View style={styles.terms}>
            <Text style={styles.sectionTitle}>Terms &amp; conditions</Text>
            <Text>{model.company.termsAndConditions}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

import Link from "next/link";

import { EmptyState } from "@/components/data/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { DetailSection } from "@/components/layout/detail";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PaymentRecord } from "@/domain/payments/types";

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

type InvoicePaymentsPanelProps = {
  readonly payments: readonly PaymentRecord[];
  readonly invoiceCurrencyCode: string;
};

/**
 * Invoice payment records list (TASK-059).
 * Multiple SUCCESSFUL/PENDING payments may coexist. Confirmed rows feed invoice
 * paid/outstanding and Partially Paid/Paid status (TASK-060).
 * Rows link to payment detail (TASK-062).
 */
export function InvoicePaymentsPanel({ payments, invoiceCurrencyCode }: InvoicePaymentsPanelProps) {
  return (
    <DetailSection
      title="Payments"
      description="Payment records for this invoice. Multiple partial payments may coexist. Confirmed applications drive paid/outstanding and Partially Paid/Paid status."
    >
      {payments.length === 0 ? (
        <EmptyState
          compact
          title="No payments yet"
          description="Record a manual payment or create a hosted checkout when sending the invoice."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Applied ({invoiceCurrencyCode})</TableHead>
              <TableHead>Settlement</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>External ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id} data-testid={`invoice-payment-row-${payment.id}`}>
                <TableCell>
                  <Link
                    href={`/payments/${payment.id}`}
                    className="text-foreground font-medium underline-offset-4 hover:underline"
                  >
                    {formatDate(payment.paymentDate)}
                  </Link>
                </TableCell>
                <TableCell>{payment.methodCode}</TableCell>
                <TableCell>
                  <StatusBadge status={payment.status} />
                </TableCell>
                <TableCell>
                  {payment.invoiceAmountApplied} {payment.invoiceCurrencyCode}
                </TableCell>
                <TableCell>
                  {payment.convertedSettlementAmount} {payment.settlementCurrencyCode}
                </TableCell>
                <TableCell>{payment.source}</TableCell>
                <TableCell className="text-muted-foreground max-w-[10rem] truncate text-xs">
                  {payment.externalTransactionId ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </DetailSection>
  );
}

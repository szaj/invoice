import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "success" | "warning" | "destructive" | "info" | "muted";

const TONE_TO_VARIANT = {
  neutral: "secondary",
  success: "success",
  warning: "warning",
  destructive: "destructive",
  info: "info",
  muted: "muted",
} as const;

/** Canonical product status → tone mapping for reusable badges. */
export const STATUS_TONES: Record<string, StatusTone> = {
  ACTIVE: "success",
  INACTIVE: "muted",
  DRAFT: "neutral",
  ISSUED: "info",
  OVERDUE: "warning",
  CANCELLED: "destructive",
  PAID: "success",
  PARTIALLY_PAID: "warning",
  PENDING: "warning",
  FAILED: "destructive",
  SUCCESSFUL: "success",
  SUCCESS: "success",
  SENT: "success",
  HEALTHY: "success",
  CONFIGURATION_ERROR: "warning",
  DISABLED: "muted",
  // Compliance-ish
  CLEAR: "success",
  UNDER_REVIEW: "warning",
  FLAGGED: "destructive",
  NOT_REVIEWED: "muted",
  APPROVED: "success",
  // Payment adjustment lifecycle (do not rewrite SUCCESSFUL)
  DISPUTED: "warning",
  REFUNDED: "info",
  CHARGEBACK_DEBITED: "destructive",
  CHARGEBACK_LOST: "destructive",
  CHARGEBACK_WON: "success",
  CHARGEBACK_REVERSED: "success",
  // Adjustment row statuses / types
  OPEN: "warning",
  PROCESSED: "info",
  DEBITED: "destructive",
  LOST: "destructive",
  WON: "success",
  REVERSED: "success",
  DISPUTE: "warning",
  REFUND: "info",
  CHARGEBACK: "destructive",
  REVERSAL: "success",
  NOTE: "neutral",
  // Audit actor types
  USER: "info",
  SYSTEM: "muted",
  WEBHOOK: "warning",
};

function humanizeStatus(status: string): string {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type StatusBadgeProps = {
  status: string;
  label?: string;
  className?: string;
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const tone = STATUS_TONES[status] ?? "neutral";
  return (
    <Badge variant={TONE_TO_VARIANT[tone]} className={cn(className)} data-status={status}>
      {label ?? humanizeStatus(status)}
    </Badge>
  );
}

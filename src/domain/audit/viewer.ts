import { AuditEntityTypes } from "@/domain/audit/types";

/**
 * In-app record link for known audit entity types.
 * Unknown types and missing IDs stay unlinked.
 */
export function auditEntityHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) {
    return null;
  }
  if (entityType === AuditEntityTypes.CUSTOMER) {
    return `/customers/${entityId}`;
  }
  if (entityType === AuditEntityTypes.INVOICE) {
    return `/invoices/${entityId}`;
  }
  if (entityType === AuditEntityTypes.PAYMENT) {
    return `/payments/${entityId}`;
  }
  if (entityType === AuditEntityTypes.COMPANY) {
    return `/companies/${entityId}`;
  }
  if (entityType === AuditEntityTypes.SETTINGS) {
    return "/settings/system";
  }
  if (entityType === AuditEntityTypes.CURRENCY) {
    return "/settings/currencies";
  }
  if (entityType === AuditEntityTypes.FIXED_CONVERSION_RATE) {
    return "/settings/fixed-rates";
  }
  return null;
}

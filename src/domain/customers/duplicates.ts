/**
 * Likely-duplicate detection for customers (Customers §7.3 / TASK-028).
 * Matching is case-insensitive on email and display name; phone is trimmed exact match.
 * Warnings are non-blocking for Admin/Compliance with acknowledgement.
 */

export type CustomerDuplicateMatchField = "email" | "phone" | "displayName";

export type CustomerDuplicateMatch = {
  readonly customerId: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly status: "ACTIVE" | "INACTIVE";
  readonly matchedFields: readonly CustomerDuplicateMatchField[];
};

export type CustomerDuplicateCheckInput = {
  readonly displayName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly excludeCustomerId?: string | null;
};

export const CUSTOMER_DUPLICATE_WARNING =
  "A possible duplicate customer was found. Admin or Compliance may proceed if appropriate.";
export const CUSTOMER_DUPLICATE_ACK_REQUIRED =
  "Confirm that you want to proceed despite possible duplicates.";
export const CUSTOMER_DUPLICATE_ACK_FORBIDDEN =
  "Only Admin or Compliance may proceed when a duplicate warning is present.";
export const CUSTOMER_INACTIVE_BLOCKS_NEW_INVOICE =
  "This customer is inactive. New invoices are blocked; history is preserved.";

export function normalizeDuplicateEmail(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeDuplicatePhone(phone: string | null | undefined): string | null {
  if (!phone) {
    return null;
  }
  const trimmed = phone.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeDuplicateDisplayName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Pure match helper for unit tests: given candidate rows, return matches with fields.
 */
export function matchCustomerDuplicates(
  input: CustomerDuplicateCheckInput,
  candidates: readonly {
    readonly id: string;
    readonly displayName: string;
    readonly email: string | null;
    readonly phone: string | null;
    readonly status: "ACTIVE" | "INACTIVE";
  }[],
): CustomerDuplicateMatch[] {
  const email = normalizeDuplicateEmail(input.email);
  const phone = normalizeDuplicatePhone(input.phone);
  const displayName = normalizeDuplicateDisplayName(input.displayName);
  const excludeId = input.excludeCustomerId ?? null;

  const matches: CustomerDuplicateMatch[] = [];
  for (const row of candidates) {
    if (excludeId && row.id === excludeId) {
      continue;
    }
    const matchedFields: CustomerDuplicateMatchField[] = [];
    if (email && normalizeDuplicateEmail(row.email) === email) {
      matchedFields.push("email");
    }
    if (phone && normalizeDuplicatePhone(row.phone) === phone) {
      matchedFields.push("phone");
    }
    if (normalizeDuplicateDisplayName(row.displayName) === displayName) {
      matchedFields.push("displayName");
    }
    if (matchedFields.length === 0) {
      continue;
    }
    matches.push({
      customerId: row.id,
      displayName: row.displayName,
      email: row.email,
      phone: row.phone,
      status: row.status,
      matchedFields,
    });
  }
  return matches;
}

export function canAcknowledgeCustomerDuplicates(roleCode: string | null | undefined): boolean {
  return roleCode === "ADMIN" || roleCode === "COMPLIANCE";
}

/**
 * Gate for future invoicing (TASK-028). Enforced when invoices are implemented.
 */
export function customerAllowsNewInvoice(status: "ACTIVE" | "INACTIVE"): boolean {
  return status === "ACTIVE";
}

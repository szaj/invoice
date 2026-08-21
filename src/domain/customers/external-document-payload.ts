import type { CustomerNoteRecord } from "@/domain/customers/notes";
import type { CustomerRecord } from "@/domain/customers/types";

/**
 * Fixture for future PDF/email document payloads (TASK-027).
 * Internal customer notes must never appear on customer-facing documents.
 */
export type CustomerExternalDocumentPayload = {
  readonly customerId: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly billingAddress: {
    readonly line1: string | null;
    readonly line2: string | null;
    readonly city: string | null;
    readonly region: string | null;
    readonly postalCode: string | null;
    readonly countryCode: string | null;
  };
};

export function buildCustomerExternalDocumentPayload(
  customer: Pick<
    CustomerRecord,
    | "id"
    | "displayName"
    | "email"
    | "addressLine1"
    | "addressLine2"
    | "city"
    | "region"
    | "postalCode"
    | "countryCode"
  >,
  _internalNotes: readonly CustomerNoteRecord[] = [],
): CustomerExternalDocumentPayload {
  void _internalNotes;
  return {
    customerId: customer.id,
    displayName: customer.displayName,
    email: customer.email,
    billingAddress: {
      line1: customer.addressLine1,
      line2: customer.addressLine2,
      city: customer.city,
      region: customer.region,
      postalCode: customer.postalCode,
      countryCode: customer.countryCode,
    },
  };
}

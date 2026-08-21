import { customerSearchSchema, type CustomerSearchInput } from "@/domain/customers/schema";

/**
 * Parse list page searchParams into customer search input.
 * Keeps filter/query logic out of React components.
 */
export function parseCustomerListSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): CustomerSearchInput {
  const qRaw = searchParams.q;
  const statusRaw = searchParams.status;
  const companyIdRaw = searchParams.companyId;
  const q = Array.isArray(qRaw) ? qRaw[0] : qRaw;
  const status = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
  const companyId = Array.isArray(companyIdRaw) ? companyIdRaw[0] : companyIdRaw;
  const parsed = customerSearchSchema.safeParse({
    q: q && q.length > 0 ? q : undefined,
    status: status && status.length > 0 ? status : undefined,
    companyId: companyId && companyId.length > 0 ? companyId : undefined,
  });
  return parsed.success ? parsed.data : {};
}

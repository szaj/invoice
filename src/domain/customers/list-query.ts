import { customerSearchSchema, type CustomerSearchInput } from "@/domain/customers/schema";
import { firstSearchParam } from "@/domain/lists/pagination";

/**
 * Parse list page searchParams into customer search input.
 * Keeps filter/query logic out of React components.
 */
export function parseCustomerListSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): CustomerSearchInput {
  const parsed = customerSearchSchema.safeParse({
    q: firstSearchParam(searchParams.q),
    status: firstSearchParam(searchParams.status),
    companyId: firstSearchParam(searchParams.companyId),
    page: firstSearchParam(searchParams.page),
    pageSize: firstSearchParam(searchParams.pageSize),
    sortBy: firstSearchParam(searchParams.sortBy),
    sortDir: firstSearchParam(searchParams.sortDir),
  });
  return parsed.success ? parsed.data : {};
}

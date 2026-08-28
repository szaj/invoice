import Link from "next/link";

import { Button } from "@/components/ui/button";

export function ListPagination({
  page,
  pageSize,
  totalCount,
  hrefForPage,
}: {
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly hrefForPage: (nextPage: number) => string;
}) {
  if (totalCount <= 0 || pageSize <= 0) {
    return null;
  }
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={hrefForPage(page - 1)}>Previous</Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Previous
        </Button>
      )}
      {page < totalPages ? (
        <Button asChild variant="outline" size="sm">
          <Link href={hrefForPage(page + 1)}>Next</Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Next
        </Button>
      )}
      <span className="text-muted-foreground text-sm">
        Page {page} of {totalPages}
      </span>
    </div>
  );
}

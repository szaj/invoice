import { describe, expect, it } from "vitest";

import { parseCustomerListSearchParams } from "@/domain/customers/list-query";

describe("customer list search params", () => {
  it("parses q, status, and companyId filters for the list UI", () => {
    expect(
      parseCustomerListSearchParams({
        q: "  acme ",
        status: "ACTIVE",
        companyId: "11111111-1111-4111-8111-111111111111",
        page: "2",
        pageSize: "25",
      }),
    ).toEqual({
      q: "acme",
      status: "ACTIVE",
      companyId: "11111111-1111-4111-8111-111111111111",
      page: 2,
      pageSize: 25,
    });
  });

  it("ignores invalid status/companyId and empty q", () => {
    expect(parseCustomerListSearchParams({ q: "", status: "DELETED", companyId: "nope" })).toEqual(
      {},
    );
    expect(parseCustomerListSearchParams({})).toEqual({});
  });
});

import type { PermissionCode } from "@/domain/authz/permissions";

export type NavItem = {
  href: string;
  label: string;
  /** Any of these permissions grants visibility (OR). Empty = always visible when authenticated. */
  permissions?: readonly PermissionCode[];
};

export type NavGroup = {
  id: string;
  label: string;
  items: readonly NavItem[];
};

export const APP_NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [{ href: "/", label: "Home" }],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        href: "/customers",
        label: "Customers",
        permissions: ["customer.edit", "customer.create"],
      },
      {
        href: "/invoices",
        label: "Invoices",
        permissions: ["invoice.create"],
      },
      {
        href: "/payments",
        label: "Payments",
        permissions: ["invoice.create"],
      },
      {
        href: "/payments/manual",
        label: "Manual payment",
        permissions: ["payment.manual.record"],
      },
    ],
  },
  {
    id: "organization",
    label: "Organization",
    items: [
      {
        href: "/companies",
        label: "Companies",
        permissions: ["company.write"],
      },
      {
        href: "/users",
        label: "Users",
        permissions: ["user.manage"],
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      {
        href: "/settings/system",
        label: "System",
        permissions: ["settings.manage"],
      },
      {
        href: "/settings/currencies",
        label: "Currencies",
        permissions: ["currency.manage"],
      },
      {
        href: "/settings/fixed-rates",
        label: "Fixed rates",
        permissions: ["currency.manage"],
      },
      {
        href: "/settings/reporting-groups",
        label: "Reporting groups",
        permissions: ["company.write"],
      },
    ],
  },
] as const;

export function isNavItemActive(
  pathname: string,
  href: string,
  siblingHrefs: readonly string[] = [],
): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  const matches = pathname === href || pathname.startsWith(`${href}/`);
  if (!matches) {
    return false;
  }
  // Prefer the longest matching nav href so /payments does not stay active on /payments/manual.
  if (siblingHrefs.length > 0) {
    const longerMatch = siblingHrefs.some(
      (other) =>
        other !== href &&
        other.length > href.length &&
        (pathname === other || pathname.startsWith(`${other}/`)),
    );
    if (longerMatch) {
      return false;
    }
  }
  return true;
}

/** Visibility-only filter. Server-side authorization still gates each route. */
export function filterNavGroups(allowedHrefs: ReadonlySet<string>): NavGroup[] {
  return APP_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => allowedHrefs.has(item.href)),
  })).filter((group) => group.items.length > 0);
}

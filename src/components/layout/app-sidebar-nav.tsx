"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavItemActive, type NavGroup } from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";

type AppSidebarNavProps = {
  groups: readonly NavGroup[];
  onNavigate?: () => void;
  className?: string;
};

export function AppSidebarNav({ groups, onNavigate, className }: AppSidebarNavProps) {
  const pathname = usePathname();
  const siblingHrefs = groups.flatMap((group) => group.items.map((item) => item.href));

  return (
    <nav className={cn("flex flex-col gap-6", className)} aria-label="Main">
      {groups.map((group) => (
        <div key={group.id} className="grid gap-1">
          <p className="text-muted-foreground px-2 text-[11px] font-medium tracking-wider uppercase">
            {group.label}
          </p>
          <ul className="grid gap-0.5">
            {group.items.map((item) => {
              const active = isNavItemActive(pathname, item.href, siblingHrefs);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

"use client";

import { MenuIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { AppSidebarNav } from "@/components/layout/app-sidebar-nav";
import type { NavGroup } from "@/components/layout/nav-config";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MobileNavProps = {
  groups: readonly NavGroup[];
};

export function MobileNav({ groups }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <XIcon /> : <MenuIcon />}
      </Button>
      {open ? (
        <>
          <button
            type="button"
            className="bg-foreground/30 fixed inset-0 z-40"
            aria-label="Close navigation overlay"
            onClick={() => setOpen(false)}
          />
          <aside
            className={cn(
              "bg-sidebar text-sidebar-foreground border-sidebar-border fixed top-0 left-0 z-50 flex h-svh w-72 flex-col border-r shadow-sm",
            )}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold tracking-tight">Invoices</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
              >
                <XIcon />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <AppSidebarNav groups={groups} onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}

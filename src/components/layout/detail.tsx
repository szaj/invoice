import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DetailFieldProps = {
  label: string;
  value?: ReactNode;
  className?: string;
};

/** Labeled definition field for detail/summary panels. */
export function DetailField({ label, value, className }: DetailFieldProps) {
  const empty =
    value === null || value === undefined || (typeof value === "string" && value.length === 0);

  return (
    <div className={cn("grid gap-1", className)}>
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="text-sm whitespace-pre-wrap">{empty ? "—" : value}</dd>
    </div>
  );
}

type DetailSectionProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DetailSection({
  title,
  description,
  actions,
  children,
  className,
}: DetailSectionProps) {
  return (
    <section className={cn("bg-card rounded-lg border shadow-xs", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="grid gap-1">
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

type MetricCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
};

export function MetricCard({ label, value, hint, className }: MetricCardProps) {
  return (
    <div className={cn("bg-card rounded-lg border px-4 py-3 shadow-xs", className)}>
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={cn("grid gap-4", className)}>
      <div className="grid gap-1 border-b pb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

type FormFieldProps = {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={htmlFor} className="text-sm leading-none font-medium">
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}

type FormActionsProps = {
  children: ReactNode;
  destructive?: ReactNode;
  className?: string;
};

export function FormActions({ children, destructive, className }: FormActionsProps) {
  return (
    <div
      className={cn("flex flex-wrap items-center justify-between gap-3 border-t pt-4", className)}
    >
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {destructive ? <div className="flex flex-wrap items-center gap-2">{destructive}</div> : null}
    </div>
  );
}

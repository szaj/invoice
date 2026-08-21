import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva("relative grid w-full gap-1 rounded-md border px-3 py-2.5 text-sm", {
  variants: {
    variant: {
      default: "border-border bg-card text-foreground",
      destructive: "border-destructive/30 bg-destructive/10 text-destructive",
      success: "border-success/30 bg-success/10 text-success",
      warning: "border-warning/40 bg-warning/15 text-warning-foreground",
      info: "border-info/30 bg-info/10 text-info",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Alert({
  className,
  variant,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("font-medium", className)} {...props} />;
}

function AlertDescription({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="alert-description" className={cn("text-sm opacity-90", className)} {...props}>
      {children as ReactNode}
    </div>
  );
}

export { Alert, AlertDescription, AlertTitle, alertVariants };

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageFrameProps = {
  children: ReactNode;
  className?: string;
  /** default | narrow (forms) | wide (tables) */
  width?: "default" | "narrow" | "wide";
};

const widthClass = {
  default: "max-w-5xl",
  narrow: "max-w-2xl",
  wide: "max-w-6xl",
} as const;

export function PageFrame({ children, className, width = "default" }: PageFrameProps) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8",
        widthClass[width],
        className,
      )}
    >
      {children}
    </main>
  );
}

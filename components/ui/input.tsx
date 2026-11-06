import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-muted disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

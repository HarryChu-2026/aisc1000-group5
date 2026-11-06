import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 py-2 text-base font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-brand text-surface hover:bg-brand-hover",
        outline: "border border-line-strong bg-surface text-brand hover:bg-brand-soft",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Button({
  asChild = false,
  className,
  variant,
  ...props
}: ComponentProps<"button"> & { asChild?: boolean; variant?: "default" | "outline" }) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant }), className)} {...props} />;
}

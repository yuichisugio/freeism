import type { VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-neutral-200 px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-neutral-950 focus-visible:ring-[3px] focus-visible:ring-neutral-950/50 aria-invalid:border-red-500 aria-invalid:ring-red-500/20 dark:border-neutral-800 dark:focus-visible:border-neutral-300 dark:focus-visible:ring-neutral-300/50 dark:aria-invalid:ring-red-900/20 dark:dark:aria-invalid:ring-red-900/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-neutral-900 text-neutral-50 dark:bg-neutral-50 dark:text-neutral-900 [a&]:hover:bg-neutral-900/90 dark:[a&]:hover:bg-neutral-50/90",
        secondary:
          "border-transparent bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50 [a&]:hover:bg-neutral-100/90 dark:[a&]:hover:bg-neutral-800/90",
        destructive:
          "border-transparent bg-red-500 text-white focus-visible:ring-red-500/20 dark:bg-red-900 dark:focus-visible:ring-red-900/20 [a&]:hover:bg-red-500/90 dark:[a&]:hover:bg-red-900/90",
        outline:
          "text-neutral-950 dark:text-neutral-50 [a&]:hover:bg-neutral-100 [a&]:hover:text-neutral-900 dark:[a&]:hover:bg-neutral-800 dark:[a&]:hover:text-neutral-50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : "span";

  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

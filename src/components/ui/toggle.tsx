"use client";

import type { VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva } from "class-variance-authority";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-[color,box-shadow] outline-none hover:bg-neutral-100 hover:text-neutral-500 focus-visible:border-neutral-950 focus-visible:ring-[3px] focus-visible:ring-neutral-950/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-red-500 aria-invalid:ring-red-500/20 data-[state=on]:bg-neutral-100 data-[state=on]:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-400 dark:focus-visible:border-neutral-300 dark:focus-visible:ring-neutral-300/50 dark:aria-invalid:border-red-900 dark:aria-invalid:ring-red-900/20 dark:dark:aria-invalid:ring-red-900/40 dark:data-[state=on]:bg-neutral-800 dark:data-[state=on]:text-neutral-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-neutral-200 bg-transparent shadow-xs hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-50",
      },
      size: {
        default: "h-9 min-w-9 px-2",
        sm: "h-8 min-w-8 px-1.5",
        lg: "h-10 min-w-10 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({ className, variant, size, ...props }: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return <TogglePrimitive.Root data-slot="toggle" className={cn(toggleVariants({ variant, size, className }))} {...props} />;
}

export { Toggle, toggleVariants };

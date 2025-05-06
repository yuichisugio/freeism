"use cache";

import type { VariantProps } from "class-variance-authority";
import * as React from "react";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

const alertVariants = cva(
  "[&>svg]:text-foreground relative w-full rounded-lg border p-4 [&>svg]:absolute [&>svg]:top-4 [&>svg]:left-4 [&>svg+div]:translate-y-[-3px] [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
        warning: "border-yellow-500/50 text-yellow-600 dark:border-yellow-500 [&>svg]:text-yellow-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * アラート
 */
function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  cacheLife("max");
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * アラートのタイトル
 */
function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  cacheLife("max");
  return <div data-slot="alert-title" className={cn("col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight", className)} {...props} />;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  cacheLife("max");
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 grid justify-items-start gap-1 text-sm text-neutral-500 dark:text-neutral-400 [&_p]:leading-relaxed", className)}
      {...props}
    />
  );
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export { Alert, AlertTitle, AlertDescription };

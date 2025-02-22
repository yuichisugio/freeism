import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("animate-pulse rounded-md bg-neutral-900/10 dark:bg-neutral-50/10", className)} {...props} />;
}

export { Skeleton };

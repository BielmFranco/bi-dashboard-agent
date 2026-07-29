import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--primary)] text-[var(--primary-foreground)]",
        secondary:
          "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]",
        outline: "text-[var(--foreground)] border-[var(--border)]",
        success:
          "border-transparent bg-[var(--success)]/15 text-[var(--success)]",
        warning:
          "border-transparent bg-[var(--warning)]/15 text-[var(--warning)]",
        destructive:
          "border-transparent bg-[var(--destructive)]/15 text-[var(--destructive)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

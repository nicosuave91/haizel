import { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends PropsWithChildren {
  tone?: "default" | "primary" | "danger" | "warning" | "success";
}

const toneClasses: Record<NonNullable<BadgeProps["tone"]>, string> = {
  default: "bg-hz-neutral-100 text-[var(--hz-text)]",
  primary: "bg-hz-primary/10 text-hz-primary",
  danger: "bg-hz-danger/10 text-hz-danger",
  warning: "bg-hz-warning/10 text-hz-warning",
  success: "bg-hz-success/10 text-hz-success"
};

export const Badge = ({ tone = "default", children }: BadgeProps) => {
  return (
    <span className={cn("rounded-full px-2 py-1 text-xs font-medium", toneClasses[tone])}>{children}</span>
  );
};

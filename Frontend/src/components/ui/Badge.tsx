import { memo } from "react";
import clsx from "clsx";

export type BadgeVariant = "orange"|"green"|"red"|"yellow"|"blue"|"purple"|"gray";

const styles: Record<BadgeVariant, string> = {
  orange: "bg-pm-orange/10 text-pm-orange border-pm-orange/20",
  green:  "bg-pm-green/10  text-pm-green  border-pm-green/20",
  red:    "bg-pm-red/10    text-pm-red    border-pm-red/20",
  yellow: "bg-pm-yellow/10 text-pm-yellow border-pm-yellow/20",
  blue:   "bg-pm-blue/10   text-pm-blue   border-pm-blue/20",
  purple: "bg-pm-purple/10 text-pm-purple border-pm-purple/20",
  gray:   "bg-pm-elevated  text-pm-muted  border-pm-border",
};
const dotClr: Record<BadgeVariant, string> = {
  orange: "bg-pm-orange", green: "bg-pm-green", red: "bg-pm-red",
  yellow: "bg-pm-yellow", blue:  "bg-pm-blue",  purple: "bg-pm-purple", gray: "bg-pm-dim",
};

export const Badge = memo(function Badge({ variant = "gray", dot, children, className }: {
  variant?: BadgeVariant; dot?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium",
      styles[variant], className
    )}>
      {dot && <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", dotClr[variant])}/>}
      {children}
    </span>
  );
});

export const METHOD_VARIANT: Record<string, BadgeVariant> = {
  GET: "green", POST: "orange", PUT: "yellow", DELETE: "red", PATCH: "blue",
};
export const STATUS_VARIANT: Record<string, BadgeVariant> = {
  completed: "green", running: "orange", pending: "gray", failed: "red",
};
export const SEV_VARIANT: Record<string, BadgeVariant> = {
  low: "blue", medium: "yellow", high: "red", critical: "red",
};

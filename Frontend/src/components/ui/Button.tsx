import { memo, ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type Variant = "send" | "primary" | "default" | "ghost" | "danger";
type Size    = "xs" | "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

const v: Record<Variant, string> = {
  send:    "bg-pm-orange hover:bg-pm-orange-h text-white font-semibold border-transparent",
  primary: "bg-pm-elevated hover:bg-[#3a3a3a] text-pm-text border-pm-border",
  default: "bg-pm-panel hover:bg-pm-elevated text-pm-text border-pm-border",
  ghost:   "bg-transparent hover:bg-pm-panel text-pm-muted hover:text-pm-text border-transparent",
  danger:  "bg-transparent hover:bg-pm-red/10 text-pm-red border-pm-red/30 hover:border-pm-red/50",
};
const s: Record<Size, string> = {
  xs: "px-2 py-1 text-xs",
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
};

export const Button = memo(function Button({
  variant = "default", size = "sm", loading = false, disabled, className, children, ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded border font-medium select-none",
        "transition-colors duration-100",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-pm-orange focus-visible:ring-offset-1 focus-visible:ring-offset-pm-bg",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        v[variant], s[size], className
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      )}
      {children}
    </button>
  );
});

import { memo, ReactNode } from "react";
import clsx from "clsx";

export const Card = memo(function Card({ title, subtitle, children, className, actions, noPadding }: {
  title?: string; subtitle?: string; children: ReactNode;
  className?: string; actions?: ReactNode; noPadding?: boolean;
}) {
  return (
    <div className={clsx("bg-pm-panel border border-pm-border rounded", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-pm-border">
          <div>
            {title    && <p className="text-sm font-semibold text-pm-text">{title}</p>}
            {subtitle && <p className="text-xs text-pm-muted mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={clsx(!noPadding && "p-4")}>{children}</div>
    </div>
  );
});

export const StatCard = memo(function StatCard({ label, value, unit, accent, warn }: {
  label: string; value: string | number; unit?: string; accent?: boolean; warn?: boolean;
}) {
  return (
    <div className="bg-pm-panel border border-pm-border rounded p-4">
      <p className="pm-label">{label}</p>
      <p className={clsx(
        "text-xl font-semibold tabular-nums mt-1",
        accent ? "text-pm-orange" : warn ? "text-pm-red" : "text-pm-text"
      )}>
        {value}
        {unit && <span className="text-xs font-normal text-pm-muted ml-1">{unit}</span>}
      </p>
    </div>
  );
});

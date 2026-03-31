import { memo, ReactNode } from "react";
import clsx from "clsx";

export const Panel = memo(function Panel({ children, className }: {
  children: ReactNode; className?: string;
}) {
  return (
    <div className={clsx("bg-pm-panel border border-pm-border rounded", className)}>
      {children}
    </div>
  );
});

export const PanelHeader = memo(function PanelHeader({ children, className }: {
  children: ReactNode; className?: string;
}) {
  return (
    <div className={clsx("flex items-center justify-between px-4 py-2.5 border-b border-pm-border", className)}>
      {children}
    </div>
  );
});

export const PanelBody = memo(function PanelBody({ children, className }: {
  children: ReactNode; className?: string;
}) {
  return <div className={clsx("p-4", className)}>{children}</div>;
});

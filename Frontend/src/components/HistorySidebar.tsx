import { useState, useCallback, memo } from "react";
import clsx from "clsx";
import { Badge, METHOD_VARIANT, STATUS_VARIANT } from "@/components/ui/Badge";
import type { LoadTestResult } from "@/types";

// ── Constants outside component — never recreated ──
const METHOD_KEYS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;
type MethodKey = typeof METHOD_KEYS[number];

const DOT_COLOR: Record<string, string> = {
  GET:    "bg-pm-green",
  POST:   "bg-pm-orange",
  PUT:    "bg-pm-yellow",
  DELETE: "bg-pm-red",
  PATCH:  "bg-pm-blue",
};

function methodLabel(raw: unknown): MethodKey {
  const s = String(raw ?? "").toUpperCase().trim() as MethodKey;
  return METHOD_KEYS.includes(s) ? s : "GET";
}

// ── Memoized history item — only re-renders when its own props change ──
const HistoryItem = memo(function HistoryItem({
  r, isSelected, isConfirm, onSelect, onConfirmDelete,
}: {
  r: LoadTestResult;
  isSelected: boolean;
  isConfirm: boolean;
  onSelect: (r: LoadTestResult) => void;
  onConfirmDelete: (e: React.MouseEvent, id: number) => void;
}) {
  const method     = methodLabel(r.config?.method);
  const url        = String(r.config?.url ?? "");
  const displayUrl = url.replace(/^https?:\/\//, "").slice(0, 28) || `Test #${r.id}`;

  return (
    <div
      onClick={() => onSelect(r)}
      className={clsx(
        "group relative flex flex-col gap-1 px-3 py-2 cursor-pointer transition-colors",
        "border-l-2",
        isSelected
          ? "border-pm-orange bg-pm-orange/5"
          : "border-transparent hover:bg-pm-panel"
      )}
    >
      {/* Method badge + URL */}
      <div className="flex items-center gap-2 min-w-0 pr-6">
        <Badge
          variant={METHOD_VARIANT[method] ?? "gray"}
          className="shrink-0 font-mono text-2xs px-1.5"
        >
          {method}
        </Badge>
        <span className="text-xs text-pm-muted truncate font-mono leading-tight">
          {displayUrl}
        </span>
      </div>

      {/* Stats row */}
      {r.status === "completed" && (
        <div className="flex items-center gap-2.5 pl-px text-2xs text-pm-dim">
          <span className="text-pm-muted tabular-nums">
            {r.avg_latency_ms?.toFixed(0) ?? "0"}ms
          </span>
          <span className={r.error_rate > 5 ? "text-pm-yellow" : ""}>
            {r.error_rate?.toFixed(1) ?? "0.0"}% err
          </span>
          {r.anomalies && r.anomalies.length > 0 && (
            <span className="text-pm-orange">{r.anomalies.length} anom</span>
          )}
        </div>
      )}

      {r.status !== "completed" && (
        <div className="pl-px">
          <Badge variant={STATUS_VARIANT[r.status] ?? "gray"} className="text-2xs">
            {r.status}
          </Badge>
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={e => onConfirmDelete(e, r.id)}
        className={clsx(
          "absolute right-2 top-2 rounded px-1.5 py-0.5 text-2xs font-medium transition-all",
          isConfirm
            ? "opacity-100 bg-pm-red/15 text-pm-red border border-pm-red/30"
            : "opacity-0 group-hover:opacity-100 text-pm-dim hover:text-pm-red"
        )}
      >
        {isConfirm ? "confirm" : "x"}
      </button>
    </div>
  );
});

interface Props {
  history: LoadTestResult[];
  selectedId: number | null;
  onSelect: (r: LoadTestResult) => void;
  onDelete: (id: number) => void;
  open: boolean;
  onToggle: () => void;
}

export function HistorySidebar({ history, selectedId, onSelect, onDelete, open, onToggle }: Props) {
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const handleConfirmDelete = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setConfirmId(prev => {
      if (prev === id) {
        onDelete(id);
        return null;
      }
      setTimeout(() => setConfirmId(c => c === id ? null : c), 3000);
      return id;
    });
  }, [onDelete]);

  return (
    <aside
      className={clsx(
        "shrink-0 flex flex-col border-r border-pm-divider bg-pm-surface select-none",
        "transition-[width] duration-200 ease-in-out overflow-hidden",
        open ? "w-56" : "w-9"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-2.5 border-b border-pm-divider shrink-0">
        {open && (
          <span className="text-xs font-semibold text-pm-muted uppercase tracking-wider ml-1">
            History
          </span>
        )}
        {open && history.length > 0 && (
          <span className="text-2xs bg-pm-elevated text-pm-dim rounded px-1.5 py-0.5 font-mono mr-auto ml-2">
            {history.length}
          </span>
        )}
        <button
          onClick={onToggle}
          title={open ? "Collapse sidebar" : "Expand sidebar"}
          className={clsx(
            "flex items-center justify-center w-5 h-5 rounded",
            "text-pm-dim hover:text-pm-text hover:bg-pm-elevated transition-colors",
            !open && "mx-auto"
          )}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7"/>
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M6 5l7 7-7 7"/>
            }
          </svg>
        </button>
      </div>

      {/* Expanded list */}
      {open && (
        <div className="flex-1 overflow-y-auto py-1">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-1.5 text-pm-dim">
              <svg className="w-4 h-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p className="text-xs">No history</p>
            </div>
          ) : (
            history.map(r => (
              <HistoryItem
                key={r.id}
                r={r}
                isSelected={selectedId === r.id}
                isConfirm={confirmId === r.id}
                onSelect={onSelect}
                onConfirmDelete={handleConfirmDelete}
              />
            ))
          )}
        </div>
      )}

      {/* Collapsed: stacked method dots */}
      {!open && history.length > 0 && (
        <div className="flex flex-col items-center py-2 gap-1.5 overflow-hidden">
          {history.slice(0, 12).map(r => {
            const method = methodLabel(r.config?.method);
            return (
              <button
                key={r.id}
                onClick={() => onSelect(r)}
                title={`${method} ${String(r.config?.url ?? "").replace(/^https?:\/\//, "").slice(0, 40)}`}
                className={clsx(
                  "w-1.5 h-1.5 rounded-full shrink-0 transition-all",
                  DOT_COLOR[method] ?? "bg-pm-dim",
                  selectedId === r.id
                    ? "ring-1 ring-pm-orange ring-offset-1 ring-offset-pm-surface"
                    : "opacity-60 hover:opacity-100"
                )}
              />
            );
          })}
        </div>
      )}
    </aside>
  );
}

import clsx from "clsx";
import { Badge, statusBadgeVariant } from "@/components/ui/Badge";
import type { LoadTestResult } from "@/types";

const methodColor: Record<string, string> = {
  GET:    "text-emerald-400",
  POST:   "text-ox-orange",
  PUT:    "text-yellow-400",
  DELETE: "text-red-400",
  PATCH:  "text-purple-400",
};

interface Props {
  history: LoadTestResult[];
  selectedId: number | null;
  onSelect: (r: LoadTestResult) => void;
}

export function HistoryPanel({ history, selectedId, onSelect }: Props) {
  if (history.length === 0) return (
    <div className="flex flex-col items-center justify-center h-32 gap-2 text-ox-subtle">
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-xs">No history yet</p>
    </div>
  );

  return (
    <div className="space-y-px">
      {history.map(r => (
        <button
          key={r.id}
          onClick={() => onSelect(r)}
          className={clsx(
            "w-full text-left px-3 py-3 rounded-lg transition-all duration-100 group",
            selectedId === r.id
              ? "bg-ox-orange/10 border border-ox-orange/20"
              : "border border-transparent hover:bg-ox-elevated"
          )}
        >
          {/* Method + URL */}
          <div className="flex items-center gap-2">
            <span className={clsx("text-[11px] font-bold w-10 shrink-0", methodColor[r.config?.method] || "text-ox-dim")}>
              {r.config?.method || "?"}
            </span>
            <span className="text-xs text-ox-text truncate font-mono">
              {r.config?.url?.replace(/^https?:\/\//, "").slice(0, 32) || `#${r.id}`}
            </span>
          </div>

          {/* Stats row */}
          {r.status === "completed" && (
            <div className="flex items-center gap-3 mt-1.5 ml-12">
              <span className="text-[10px] text-ox-muted">
                <span className="text-ox-dim">{r.avg_latency_ms.toFixed(0)}</span>ms
              </span>
              <span className={clsx("text-[10px]", r.error_rate > 5 ? "text-yellow-400" : "text-ox-muted")}>
                <span>{r.error_rate.toFixed(1)}</span>% err
              </span>
              <span className="text-[10px] text-ox-muted">
                <span className="text-ox-dim">{r.total_requests}</span> req
              </span>
              {r.anomalies && r.anomalies.length > 0 && (
                <span className="text-[10px] text-ox-orange">⚠ {r.anomalies.length}</span>
              )}
            </div>
          )}

          {r.status !== "completed" && (
            <div className="ml-12 mt-1">
              <Badge variant={statusBadgeVariant(r.status)} className="text-[9px]">{r.status}</Badge>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

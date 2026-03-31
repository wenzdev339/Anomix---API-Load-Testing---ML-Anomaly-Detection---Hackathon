import { useMemo, memo, useState } from "react";
import clsx from "clsx";
import { Badge, STATUS_VARIANT, SEV_VARIANT } from "@/components/ui/Badge";
import { Card, StatCard } from "@/components/ui/Card";
import type { LoadTestResult } from "@/types";

// ── Helpers outside component ──
const METHOD_COLOR: Record<string, string> = {
  GET: "text-pm-green", POST: "text-pm-orange",
  PUT: "text-pm-yellow", DELETE: "text-pm-red", PATCH: "text-pm-blue",
};

function latencyColor(ms: number) {
  return ms > 1000 ? "text-pm-red" : ms > 500 ? "text-pm-yellow" : "text-pm-text";
}

function statusCodeClass(code: string) {
  if (code.startsWith("2")) return "bg-pm-green/10 text-pm-green border-pm-green/20";
  if (code.startsWith("3")) return "bg-pm-blue/10 text-pm-blue border-pm-blue/20";
  if (code.startsWith("4")) return "bg-pm-yellow/10 text-pm-yellow border-pm-yellow/20";
  return "bg-pm-red/10 text-pm-red border-pm-red/20";
}

const ANOMALY_BORDER: Record<string, string> = {
  critical: "border-pm-red/25 bg-pm-red/5",
  high:     "border-pm-red/20 bg-pm-red/5",
  medium:   "border-pm-yellow/25 bg-pm-yellow/5",
  low:      "border-pm-blue/20 bg-pm-blue/5",
};

// ── JSON syntax highlighter (no extra dependency) ──
function highlightJson(raw: string): string {
  try {
    const pretty = JSON.stringify(JSON.parse(raw), null, 2);
    return pretty
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
        match => {
          if (/^"/.test(match)) {
            if (/:$/.test(match)) return `<span style="color:#9CDCFE">${match}</span>`; // key
            return `<span style="color:#CE9178">${match}</span>`; // string value
          }
          if (/true|false/.test(match)) return `<span style="color:#569CD6">${match}</span>`;
          if (/null/.test(match))        return `<span style="color:#569CD6">${match}</span>`;
          return `<span style="color:#B5CEA8">${match}</span>`; // number
        }
      );
  } catch {
    // Not JSON — return as plain text
    return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

// ── Main export ──
export const ResponseViewer = memo(function ResponseViewer({ result, loading, error }: {
  result: LoadTestResult | null; loading: boolean; error: string | null;
}) {
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-pm-muted">
      <div className="w-8 h-8 rounded-full border border-pm-border border-t-pm-orange animate-spin"/>
      <p className="text-sm">Running load test...</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <p className="text-sm font-medium text-pm-red">Test Failed</p>
      <p className="text-xs text-pm-muted text-center max-w-sm">{error}</p>
    </div>
  );

  if (!result) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-pm-dim">
      <svg className="w-10 h-10 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
          d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
      <p className="text-sm">Send a request to see the response</p>
    </div>
  );

  return <ResultBody result={result}/>;
});

// ── Inner tabs ──
type InnerTab = "body" | "headers" | "metrics" | "anomalies";

const ResultBody = memo(function ResultBody({ result }: { result: LoadTestResult }) {
  const [innerTab, setInnerTab] = useState<InnerTab>("body");

  const successRate = useMemo(() =>
    result.total_requests > 0
      ? Math.round(result.successful_requests / result.total_requests * 100)
      : 0,
    [result.total_requests, result.successful_requests]
  );

  const percentiles = useMemo(() => [
    ["Min", result.min_latency_ms],
    ["P50", result.p50_latency_ms],
    ["Avg", result.avg_latency_ms],
    ["P95", result.p95_latency_ms],
    ["P99", result.p99_latency_ms],
  ] as [string, number][], [
    result.min_latency_ms, result.p50_latency_ms, result.avg_latency_ms,
    result.p95_latency_ms, result.p99_latency_ms,
  ]);

  const statusCodeEntries = useMemo(
    () => Object.entries(result.status_codes),
    [result.status_codes]
  );

  const headerEntries = useMemo(
    () => Object.entries(result.sample_response_headers ?? {}),
    [result.sample_response_headers]
  );

  const highlightedBody = useMemo(() => {
    if (!result.sample_response_body) return null;
    return highlightJson(result.sample_response_body);
  }, [result.sample_response_body]);

  const anomalyCount = result.anomalies?.length ?? 0;

  const innerTabs: { id: InnerTab; label: string; badge?: number }[] = [
    { id: "body",      label: "Body" },
    { id: "headers",   label: "Headers", badge: headerEntries.length || undefined },
    { id: "metrics",   label: "Metrics" },
    { id: "anomalies", label: "Anomalies", badge: anomalyCount || undefined },
  ];

  return (
    <div className="flex flex-col h-full animate-fade-in">

      {/* Status bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-pm-divider bg-pm-panel">
        <Badge variant={STATUS_VARIANT[result.status] ?? "gray"} dot>
          {result.status.toUpperCase()}
        </Badge>
        {result.config && (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className={clsx("font-bold text-xs shrink-0 font-mono", METHOD_COLOR[result.config.method])}>
              {result.config.method}
            </span>
            <span className="text-xs text-pm-muted font-mono truncate">
              {result.config.url}
            </span>
          </div>
        )}
        <div className="flex items-center gap-4 text-xs text-pm-dim shrink-0">
          {result.duration_seconds != null && (
            <span>
              <span className="text-pm-text font-medium">{result.duration_seconds.toFixed(2)}s</span> total
            </span>
          )}
          <span>
            <span className="text-pm-text font-medium">{result.total_requests}</span> reqs
          </span>
          <span className={clsx(
            "font-medium",
            result.avg_latency_ms > 1000 ? "text-pm-red" : result.avg_latency_ms > 500 ? "text-pm-yellow" : "text-pm-green"
          )}>
            {result.avg_latency_ms.toFixed(0)} ms avg
          </span>
        </div>
      </div>

      {/* Inner tab bar */}
      <div className="shrink-0 flex items-center border-b border-pm-divider bg-pm-surface px-1">
        {innerTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setInnerTab(t.id)}
            className={clsx("pm-tab", innerTab === t.id ? "pm-tab-on" : "pm-tab-off")}
          >
            {t.label}
            {t.badge != null && (
              <span className="ml-1.5 text-2xs rounded px-1.5 font-semibold bg-pm-elevated text-pm-dim">
                {t.badge}
              </span>
            )}
          </button>
        ))}
        {result.error_rate > 0 && (
          <span className="ml-auto mr-3 text-2xs text-pm-yellow">
            {result.error_rate.toFixed(1)}% errors
          </span>
        )}
      </div>

      {/* Panel content */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* BODY */}
        {innerTab === "body" && (
          <div className="h-full">
            {highlightedBody ? (
              <pre
                className="p-4 text-xs font-mono leading-relaxed text-pm-text whitespace-pre-wrap break-all"
                dangerouslySetInnerHTML={{ __html: highlightedBody }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-pm-dim">
                <svg className="w-6 h-6 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <p className="text-xs">
                  {result.status === "completed"
                    ? "No response body was captured (first request may have failed)"
                    : "No body available"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* HEADERS */}
        {innerTab === "headers" && (
          <div className="p-4">
            {headerEntries.length === 0 ? (
              <p className="text-xs text-pm-muted">No response headers captured.</p>
            ) : (
              <table className="w-full text-xs font-mono">
                <tbody className="divide-y divide-pm-divider">
                  {headerEntries.map(([k, v]) => (
                    <tr key={k} className="group">
                      <td className="py-1.5 pr-4 text-pm-muted w-48 shrink-0 align-top">{k}</td>
                      <td className="py-1.5 text-pm-text break-all">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* METRICS */}
        {innerTab === "metrics" && (
          <div className="p-4 space-y-4">
            {/* Key stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Avg Latency"  value={result.avg_latency_ms.toFixed(1)} unit="ms"
                accent warn={result.avg_latency_ms > 1000}/>
              <StatCard label="Throughput"   value={result.throughput_rps.toFixed(1)} unit="req/s"/>
              <StatCard label="Error Rate"   value={`${result.error_rate.toFixed(1)}%`}
                warn={result.error_rate > 10}/>
              <StatCard label="Success Rate" value={`${successRate}%`}
                accent={successRate >= 95} warn={successRate < 80}/>
            </div>

            {/* Percentiles */}
            <Card title="Latency Percentiles">
              <div className="grid grid-cols-5 divide-x divide-pm-border text-center">
                {percentiles.map(([l, v]) => (
                  <div key={l} className="py-3">
                    <p className="pm-label text-center">{l}</p>
                    <p className={clsx("text-lg font-semibold tabular-nums mt-1", latencyColor(v))}>
                      {v.toFixed(0)}<span className="text-2xs text-pm-dim ml-0.5">ms</span>
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Status codes */}
            {statusCodeEntries.length > 0 && (
              <Card title="Status Codes">
                <div className="flex flex-wrap gap-2">
                  {statusCodeEntries.map(([code, count]) => (
                    <div key={code} className={clsx(
                      "flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-mono",
                      statusCodeClass(code)
                    )}>
                      <span className="font-bold">{code}</span>
                      <span className="opacity-50">x{count}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Errors */}
            {result.error_messages?.length > 0 && (
              <Card title="Errors">
                <div className="space-y-1">
                  {result.error_messages.map((m, i) => (
                    <p key={i} className="font-mono text-xs text-pm-red bg-pm-red/5 border border-pm-red/15 rounded px-3 py-2">
                      {m}
                    </p>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ANOMALIES */}
        {innerTab === "anomalies" && (
          <div className="p-4">
            {anomalyCount === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-pm-dim">
                <svg className="w-5 h-5 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p className="text-xs">No anomalies detected</p>
              </div>
            ) : (
              <div className="space-y-2">
                {result.anomalies!.map(a => (
                  <div key={a.id} className={clsx(
                    "flex items-start gap-3 rounded border p-3",
                    ANOMALY_BORDER[a.severity] ?? "border-pm-border"
                  )}>
                    <Badge variant={SEV_VARIANT[a.severity] ?? "gray"} className="shrink-0 mt-px">
                      {a.severity}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-pm-text">
                        {a.anomaly_type_display || a.anomaly_type}
                      </p>
                      <p className="text-xs text-pm-muted mt-0.5">{a.description}</p>
                    </div>
                    <span className="text-2xs text-pm-dim font-mono shrink-0">{a.score.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
});

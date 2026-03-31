import { useEffect, useState, useCallback, useMemo } from "react";
import clsx from "clsx";
import { RequestBuilder } from "@/components/RequestBuilder";
import { ResponseViewer } from "@/components/ResponseViewer";
import { Dashboard } from "@/components/Dashboard";
import { HistorySidebar } from "@/components/HistorySidebar";
import { useLoadTest } from "@/hooks/useLoadTest";
import type { LoadTestResult } from "@/types";

type BottomTab = "response" | "analytics";

const TABS: [BottomTab, string][] = [
  ["response",  "Response"],
  ["analytics", "Analytics"],
];

export function Home() {
  const { result, history, loading, error, runTest, loadHistory, selectResult, deleteResult } = useLoadTest();
  const [bottomTab,        setBottomTab]        = useState<BottomTab>("response");
  const [sidebarOpen,      setSidebarOpen]      = useState(true);
  // Track whether Dashboard has ever been mounted — once true, keep it in the DOM
  const [dashboardReady,   setDashboardReady]   = useState(false);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    if (result) setBottomTab("response");
  }, [result?.id]);

  // When user first visits analytics tab, mount Dashboard (stays mounted after)
  useEffect(() => {
    if (bottomTab === "analytics") setDashboardReady(true);
  }, [bottomTab]);

  const handleSelectResult = useCallback((r: LoadTestResult) => {
    selectResult(r);
    setBottomTab("response");
  }, [selectResult]);

  const handleToggleSidebar = useCallback(() => setSidebarOpen(o => !o), []);

  const completedCount = useMemo(
    () => history.filter(r => r.status === "completed").length,
    [history]
  );

  const showAnalytics = bottomTab === "analytics";

  return (
    <div className="flex h-full overflow-hidden">

      {/* History sidebar */}
      <HistorySidebar
        history={history}
        selectedId={result?.id ?? null}
        onSelect={handleSelectResult}
        onDelete={deleteResult}
        open={sidebarOpen}
        onToggle={handleToggleSidebar}
      />

      {/* Main workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Request builder */}
        <div className="shrink-0 border-b border-pm-divider">
          <RequestBuilder onRun={runTest} loading={loading}/>
        </div>

        {/* Tab bar */}
        <div className="shrink-0 flex items-center border-b border-pm-divider bg-pm-surface px-1">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setBottomTab(id)}
              className={clsx("pm-tab", bottomTab === id ? "pm-tab-on" : "pm-tab-off")}
            >
              {label}
              {id === "response" && result && (
                <span className={clsx(
                  "ml-1.5 text-2xs rounded-full px-1.5 font-semibold tabular-nums",
                  result.status === "completed"
                    ? "bg-pm-green/15 text-pm-green"
                    : "bg-pm-red/15 text-pm-red"
                )}>
                  {result.status === "completed"
                    ? `${result.avg_latency_ms?.toFixed(0) ?? "?"}ms`
                    : result.status}
                </span>
              )}
              {id === "analytics" && completedCount > 0 && (
                <span className="ml-1.5 text-2xs rounded px-1.5 font-semibold bg-pm-elevated text-pm-dim">
                  {completedCount}
                </span>
              )}
            </button>
          ))}

          {history.length > 0 && (
            <span className="ml-auto mr-3 text-2xs text-pm-dim">
              {history.length} run{history.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Panel — both kept in DOM after first mount; toggled with CSS */}
        <div className="flex-1 min-h-0 overflow-hidden bg-pm-bg relative">

          {/* Response — always mounted */}
          <div className={clsx("absolute inset-0", showAnalytics && "invisible pointer-events-none")}>
            <ResponseViewer result={result} loading={loading} error={error}/>
          </div>

          {/* Analytics — mounted lazily on first visit, then always kept alive */}
          {dashboardReady && (
            <div className={clsx("absolute inset-0", !showAnalytics && "invisible pointer-events-none")}>
              <Dashboard currentResultId={result?.id}/>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

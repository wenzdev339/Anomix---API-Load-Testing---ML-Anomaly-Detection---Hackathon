import { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { Card, StatCard } from "@/components/ui/Card";
import { Badge, SEV_VARIANT } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { api } from "@/services/api";
import type { MetricsData, PredictionResult, AnomalyRecord } from "@/types";

// ── Constants outside component to avoid recreation every render ──
const CHART_MARGIN = { top: 4, right: 4, left: -20, bottom: 0 };
const AREA_GRADIENT = (
  <defs>
    <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stopColor="#FF6C37" stopOpacity={0.25}/>
      <stop offset="100%" stopColor="#FF6C37" stopOpacity={0}/>
    </linearGradient>
  </defs>
);
const AXIS_TICK_STYLE = { fill: "#555", fontSize: 10 };
const GRID_STYLE = { strokeDasharray: "3 3", stroke: "#2E2E2E" };

// ── Memoized tooltip ──
const Tip = memo(({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-pm-elevated border border-pm-border rounded px-3 py-2 text-xs shadow-xl">
      <p className="text-pm-muted mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">
            {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
          </span>
        </p>
      ))}
    </div>
  );
});

const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b) / arr.length : 0;

export function Dashboard({ currentResultId: _currentResultId }: { currentResultId?: number }) {
  const [metrics,    setMetrics]    = useState<MetricsData[]>([]);
  const [anomalies,  setAnomalies]  = useState<AnomalyRecord[]>([]);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [loadLevel,  setLoadLevel]  = useState(100);
  const [predicting, setPredicting] = useState(false);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, a] = await Promise.all([api.getMetrics(), api.getAnomalies()]);
      setMetrics(m);
      setAnomalies(a.slice(0, 20));
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const predict = useCallback(async () => {
    setPredicting(true);
    try { setPrediction(await api.predict({ load_level: loadLevel })); }
    catch {}
    finally { setPredicting(false); }
  }, [loadLevel]);

  // ── Memoize chart data — only recompute when metrics changes ──
  const trendData = useMemo(() =>
    metrics.flatMap((m, i) =>
      m.time_series.map(pt => ({ x: `R${i + 1}`, latency: pt.latency_ms }))
    ).slice(-50),
    [metrics]
  );

  const barData = useMemo(() =>
    metrics.slice(0, 8).map(m => ({
      name: `#${m.result_id}`,
      avg:  +m.avg_latency_ms.toFixed(1),
      p95:  +m.p95_latency_ms.toFixed(1),
    })),
    [metrics]
  );

  // ── Memoize aggregates — single pass over metrics ──
  const aggregates = useMemo(() => ({
    avgLatency:    avg(metrics.map(m => m.avg_latency_ms)),
    avgThroughput: avg(metrics.map(m => m.throughput_rps)),
    avgErrorRate:  avg(metrics.map(m => m.error_rate)),
  }), [metrics]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-pm-text">Analytics Overview</p>
          <p className="text-xs text-pm-muted mt-0.5">
            {metrics.length} test run{metrics.length !== 1 ? "s" : ""} &middot; {anomalies.length} anomalies
          </p>
        </div>
        <Button variant="default" size="xs" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {/* Aggregate stats */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Avg Latency"    value={aggregates.avgLatency.toFixed(1)}    unit="ms" accent/>
          <StatCard label="Avg Throughput" value={aggregates.avgThroughput.toFixed(1)} unit="rps"/>
          <StatCard label="Avg Error Rate" value={`${aggregates.avgErrorRate.toFixed(1)}%`}
            warn={aggregates.avgErrorRate > 10}/>
          <StatCard label="Total Anomalies" value={anomalies.length} warn={anomalies.length > 0}/>
        </div>
      )}

      {/* Latency trend */}
      {trendData.length > 0 && (
        <Card title="Latency Trend">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData} margin={CHART_MARGIN}>
              {AREA_GRADIENT}
              <CartesianGrid {...GRID_STYLE}/>
              <XAxis dataKey="x" tick={AXIS_TICK_STYLE}/>
              <YAxis tick={AXIS_TICK_STYLE}/>
              <Tooltip content={<Tip/>}/>
              <Area type="monotone" dataKey="latency" name="Latency (ms)"
                stroke="#FF6C37" fill="url(#lg)" strokeWidth={1.5} dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Bar comparison */}
      {barData.length > 0 && (
        <Card title="Per-Test Latency (Avg vs P95)">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} barGap={2} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID_STYLE}/>
              <XAxis dataKey="name" tick={AXIS_TICK_STYLE}/>
              <YAxis tick={AXIS_TICK_STYLE}/>
              <Tooltip content={<Tip/>}/>
              <Bar dataKey="avg" name="Avg (ms)" fill="#FF6C37" radius={[2, 2, 0, 0]} isAnimationActive={false}/>
              <Bar dataKey="p95" name="P95 (ms)" fill="#7A3320" radius={[2, 2, 0, 0]} isAnimationActive={false}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ML Prediction */}
      <Card
        title="Performance Prediction"
        subtitle="Estimate latency and failure probability at any load level"
        actions={
          <Button variant="send" size="xs" loading={predicting} onClick={predict}>Predict</Button>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-5">
            <div className="flex-1">
              <label className="pm-label">Concurrent Users</label>
              <div className="flex items-center gap-4 mt-2">
                <input
                  type="range" min={1} max={500} value={loadLevel}
                  onChange={e => setLoadLevel(+e.target.value)}
                  className="flex-1 accent-pm-orange h-1 rounded cursor-pointer"
                />
                <span className="text-lg font-bold text-pm-orange w-10 text-right tabular-nums">
                  {loadLevel}
                </span>
              </div>
            </div>
          </div>

          {prediction && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in">
              <StatCard label="Predicted Latency"
                value={prediction.predicted_latency_ms.toFixed(0)} unit="ms" accent/>
              <StatCard label="Error Rate"
                value={`${prediction.predicted_error_rate.toFixed(1)}%`}
                warn={prediction.predicted_error_rate > 10}/>
              <StatCard label="Failure Probability"
                value={`${(prediction.failure_probability * 100).toFixed(1)}%`}
                warn={prediction.failure_probability > 0.3}/>
              <div className="bg-pm-panel border border-pm-border rounded p-4">
                <p className="pm-label">Model</p>
                <Badge variant={prediction.method === "ml" ? "green" : "yellow"} dot className="mt-1.5">
                  {prediction.method === "ml" ? "ML Model" : "Statistical"}
                </Badge>
                <p className="text-2xs text-pm-muted mt-1.5">
                  {(prediction.confidence_score * 100).toFixed(0)}% confidence
                </p>
              </div>
            </div>
          )}

          {!prediction && !predicting && (
            <p className="text-xs text-pm-muted">Set a load level and click Predict.</p>
          )}
        </div>
      </Card>

      {/* Anomaly log */}
      {anomalies.length > 0 && (
        <Card title="Anomaly Log">
          <div className="divide-y divide-pm-border">
            {anomalies.map(a => (
              <div key={a.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <Badge variant={SEV_VARIANT[a.severity] ?? "gray"} className="shrink-0">
                  {a.severity}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-pm-text">
                    {a.anomaly_type_display || a.anomaly_type}
                  </p>
                  <p className="text-xs text-pm-muted truncate">{a.description}</p>
                </div>
                <span className="text-2xs text-pm-dim font-mono shrink-0">#{a.test_result}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!loading && metrics.length === 0 && (
        <div className="flex items-center justify-center h-40 text-pm-muted text-sm">
          No test data yet. Run a load test first.
        </div>
      )}
    </div>
  );
}

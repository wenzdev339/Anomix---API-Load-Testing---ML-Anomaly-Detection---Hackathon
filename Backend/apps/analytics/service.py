"""
Analytics Service
-----------------
Processes LoadTestResult records to derive time-series metrics
and delegates anomaly detection / prediction to the ML app.
"""
from __future__ import annotations

import math
from typing import TYPE_CHECKING

from .models import MetricSnapshot, AnomalyRecord, PredictionRecord

if TYPE_CHECKING:
    from apps.loadtest.models import LoadTestResult


def build_snapshots(result: "LoadTestResult") -> list[MetricSnapshot]:
    """
    Build per-request MetricSnapshot records from raw latencies stored in
    the LoadTestResult. Groups them into batches of 10 for the time-series.
    """
    raw_latencies: list[float] = result.raw_latencies or []
    if not raw_latencies:
        return []

    batch_size = max(1, len(raw_latencies) // 20)
    snapshots = []

    for i in range(0, len(raw_latencies), batch_size):
        batch = raw_latencies[i : i + batch_size]
        avg_latency = sum(batch) / len(batch)

        # error_rate approximation based on known total error_rate
        error_rate = result.error_rate

        # throughput: extrapolate from global throughput
        throughput = result.throughput_rps

        snapshot = MetricSnapshot(
            test_result=result,
            latency_ms=round(avg_latency, 2),
            throughput_rps=round(throughput, 2),
            error_rate=round(error_rate, 2),
            request_index=i,
        )
        snapshots.append(snapshot)

    MetricSnapshot.objects.bulk_create(snapshots)
    return snapshots


def get_metrics_for_result(result: "LoadTestResult") -> dict:
    """Return structured metrics dict for a test result."""
    snapshots = result.snapshots.all()
    latencies = [s.latency_ms for s in snapshots]

    return {
        "result_id": result.pk,
        "status": result.status,
        "total_requests": result.total_requests,
        "successful_requests": result.successful_requests,
        "failed_requests": result.failed_requests,
        "avg_latency_ms": result.avg_latency_ms,
        "min_latency_ms": result.min_latency_ms,
        "max_latency_ms": result.max_latency_ms,
        "p50_latency_ms": result.p50_latency_ms,
        "p95_latency_ms": result.p95_latency_ms,
        "p99_latency_ms": result.p99_latency_ms,
        "throughput_rps": result.throughput_rps,
        "error_rate": result.error_rate,
        "status_codes": result.status_codes,
        "duration_seconds": result.duration_seconds,
        "time_series": [
            {
                "index": s.request_index,
                "latency_ms": s.latency_ms,
                "throughput_rps": s.throughput_rps,
                "error_rate": s.error_rate,
            }
            for s in snapshots
        ],
        "anomalies": [
            {
                "type": a.anomaly_type,
                "severity": a.severity,
                "score": a.score,
                "description": a.description,
                "metric_value": a.metric_value,
                "threshold_value": a.threshold_value,
                "detected_at": a.detected_at.isoformat(),
            }
            for a in result.anomalies.all()
        ],
    }

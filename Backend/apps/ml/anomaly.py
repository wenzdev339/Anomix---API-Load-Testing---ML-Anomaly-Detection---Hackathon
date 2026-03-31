"""
Anomaly Detection Module
-------------------------
Strategy 1 — ML (IsolationForest):
    Uses decision_function score. Negative score = anomaly.
    Falls back to statistical if model not loaded.

Strategy 2 — Statistical fallback:
    Z-score + absolute threshold checks.
"""
from __future__ import annotations
import logging
import statistics

log = logging.getLogger(__name__)

# Statistical thresholds
LATENCY_SPIKE_RATIO   = 3.0    # P99 > avg * 3x
HIGH_ERROR_THRESHOLD  = 20.0   # error_rate > 20 %
HIGH_CV_THRESHOLD     = 1.5    # coefficient of variation > 1.5
ISO_ANOMALY_THRESHOLD = 0.0    # IsolationForest: score < 0 = anomaly


def detect_statistical(result) -> list[dict]:
    """Pure-math anomaly detection. Always available."""
    anomalies = []
    avg  = result.avg_latency_ms
    p99  = result.p99_latency_ms
    err  = result.error_rate
    raws = result.raw_latencies or []

    # Latency spike
    if avg > 0 and p99 > avg * LATENCY_SPIKE_RATIO:
        ratio = p99 / avg
        sev   = "critical" if ratio > 10 else "high" if ratio > 5 else "medium"
        anomalies.append({
            "anomaly_type":    "latency_spike",
            "severity":        sev,
            "score":           round(min(ratio / 10, 1.0), 4),
            "description":     f"P99 latency {p99:.0f}ms is {ratio:.1f}× the average {avg:.0f}ms.",
            "metric_value":    p99,
            "threshold_value": avg * LATENCY_SPIKE_RATIO,
        })

    # High error rate
    if err > HIGH_ERROR_THRESHOLD:
        sev = "critical" if err > 50 else "high" if err > 30 else "medium"
        anomalies.append({
            "anomaly_type":    "high_error_rate",
            "severity":        sev,
            "score":           round(min(err / 100, 1.0), 4),
            "description":     f"Error rate {err:.1f}% exceeds {HIGH_ERROR_THRESHOLD:.0f}% threshold.",
            "metric_value":    err,
            "threshold_value": HIGH_ERROR_THRESHOLD,
        })

    # High variance / throughput instability
    if len(raws) > 10:
        try:
            cv = statistics.stdev(raws) / avg if avg > 0 else 0
            if cv > HIGH_CV_THRESHOLD:
                sev = "high" if cv > 3 else "medium"
                anomalies.append({
                    "anomaly_type":    "throughput_drop",
                    "severity":        sev,
                    "score":           round(min(cv / 5, 1.0), 4),
                    "description":     f"Latency variance is unstable (CV={cv:.2f}), indicating throughput fluctuation.",
                    "metric_value":    cv,
                    "threshold_value": HIGH_CV_THRESHOLD,
                })
        except statistics.StatisticsError:
            pass

    return anomalies


def detect_with_isolation_forest(iso_model, scaler, threshold: float, result) -> list[dict]:
    """
    ML-based detection using IsolationForest.
    Merges with statistical checks for completeness.
    """
    try:
        import numpy as np
        import datetime

        avg = result.avg_latency_ms
        err = result.error_rate
        now = datetime.datetime.utcnow()

        features = np.array([[
            float(result.config.concurrency),
            avg,
            err,
            float(now.hour),
            float(now.weekday() >= 5),
        ]])

        X_sc  = scaler.transform(features)
        score = float(iso_model.decision_function(X_sc)[0])
        # decision_function: negative = anomaly, positive = normal
        is_anomaly = score < threshold

        anomalies = []
        if is_anomaly:
            norm_score = round(min(abs(score) / (abs(threshold) + 1e-6), 1.0), 4)
            sev = "critical" if score < threshold * 2 else "high" if score < threshold * 1.5 else "medium"
            anomalies.append({
                "anomaly_type":    "general",
                "severity":        sev,
                "score":           norm_score,
                "description":     (
                    f"IsolationForest detected an anomalous request pattern "
                    f"(decision score={score:.4f}, threshold={threshold:.4f})."
                ),
                "metric_value":    score,
                "threshold_value": threshold,
            })

        # Also run statistical and merge (avoid duplicates)
        seen  = {a["anomaly_type"] for a in anomalies}
        for a in detect_statistical(result):
            if a["anomaly_type"] not in seen:
                anomalies.append(a)

        return anomalies

    except Exception as exc:
        log.warning("IsolationForest detection failed, falling back to statistical: %s", exc)
        return detect_statistical(result)

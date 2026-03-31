"""
ML Service (Singleton)
-----------------------
Loads scikit-learn models once at startup.
Falls back to statistical methods if models are not trained.

Public API:
    MLService.instance().predict_performance(load_level) → dict
    MLService.instance().detect_anomalies(result)        → list[dict]
    MLService.instance().is_ready                        → bool
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from threading import Lock
from typing import Optional

log = logging.getLogger(__name__)

_INSTANCE: Optional["MLService"] = None
_LOCK = Lock()


class MLService:

    def __init__(self):
        self._iso        = None   # IsolationForest
        self._lat_model  = None   # latency predictor
        self._err_model  = None   # error rate predictor
        self._scaler     = None   # StandardScaler
        self._threshold  = 0.0    # IsolationForest decision threshold
        self._ready      = False
        self._load()

    # ── Singleton ─────────────────────────────────────────────────────────────

    @classmethod
    def instance(cls) -> "MLService":
        global _INSTANCE
        if _INSTANCE is None:
            with _LOCK:
                if _INSTANCE is None:
                    _INSTANCE = cls()
        return _INSTANCE

    # ── Load ──────────────────────────────────────────────────────────────────

    def _load(self):
        try:
            from django.conf import settings
            model_dir = Path(settings.MODEL_PATH).parent
        except Exception:
            model_dir = Path(__file__).resolve().parents[2] / "model"

        files = {
            "iso":       model_dir / "anomaly_model.pkl",
            "lat":       model_dir / "predictor_latency.pkl",
            "err":       model_dir / "predictor_error.pkl",
            "scaler":    model_dir / "scaler.pkl",
            "threshold": model_dir / "anomaly_threshold.npy",
        }

        missing = [k for k, p in files.items() if not p.exists()]
        if missing:
            log.warning(
                "ML models not found (%s). Run `python -m apps.ml.train` to train them. "
                "Using statistical fallback.",
                ", ".join(missing),
            )
            return

        try:
            import joblib
            import numpy as np

            self._iso       = joblib.load(files["iso"])
            self._lat_model = joblib.load(files["lat"])
            self._err_model = joblib.load(files["err"])
            self._scaler    = joblib.load(files["scaler"])
            self._threshold = float(np.load(files["threshold"])[0])
            self._ready     = True

            log.info(
                "ML models loaded (IsolationForest + GradientBoosting). "
                "Anomaly threshold=%.4f",
                self._threshold,
            )
        except Exception as exc:
            log.error("Failed to load ML models: %s", exc)

    # ── Public API ────────────────────────────────────────────────────────────

    @property
    def is_ready(self) -> bool:
        return self._ready

    def predict_performance(
        self,
        load_level: int,
        prev_latency: float = 200.0,
        prev_error_rate: float = 2.0,
    ) -> dict:
        """
        Predict latency_ms and error_rate for a given concurrent load level.

        Returns:
            predicted_latency_ms  float
            predicted_error_rate  float   (%)
            failure_probability   float   (0–1)
            confidence_score      float   (0–1)
            method                "ml" | "statistical"
        """
        if not self._ready:
            return self._statistical_predict(load_level)

        try:
            import numpy as np
            import datetime

            now  = datetime.datetime.utcnow()
            feat = np.array([[
                float(load_level),
                prev_latency,
                prev_error_rate,
                float(now.hour),
                float(now.weekday() >= 5),
            ]])
            X_sc = self._scaler.transform(feat)

            pred_lat = float(self._lat_model.predict(X_sc)[0])
            pred_err = float(self._err_model.predict(X_sc)[0])
            pred_lat = max(pred_lat, 1.0)
            pred_err = max(min(pred_err, 100.0), 0.0)

            # Failure probability: weighted combo of error rate + latency pressure
            fail_prob = min(
                pred_err / 100.0 * 0.7 + (pred_lat / 8000.0) * 0.3,
                1.0,
            )

            return {
                "predicted_latency_ms": round(pred_lat, 2),
                "predicted_error_rate": round(pred_err, 2),
                "failure_probability":  round(fail_prob, 4),
                "confidence_score":     0.88,
                "method":               "ml",
            }
        except Exception as exc:
            log.warning("ML prediction failed, falling back: %s", exc)
            return self._statistical_predict(load_level)

    def detect_anomalies(self, result) -> list[dict]:
        """Run anomaly detection on a completed LoadTestResult."""
        from apps.ml.anomaly import detect_statistical, detect_with_isolation_forest

        if self._ready:
            return detect_with_isolation_forest(
                self._iso, self._scaler, self._threshold, result
            )
        return detect_statistical(result)

    # ── Statistical fallback ──────────────────────────────────────────────────

    @staticmethod
    def _statistical_predict(load_level: int) -> dict:
        latency  = 40.0 + load_level * 0.9
        error    = min((load_level / 500.0) ** 2.2 * 35, 100.0)
        fail     = min(error / 100.0 * 0.7 + (latency / 8000.0) * 0.3, 1.0)
        return {
            "predicted_latency_ms": round(latency, 2),
            "predicted_error_rate": round(error, 2),
            "failure_probability":  round(fail, 4),
            "confidence_score":     0.55,
            "method":               "statistical",
        }

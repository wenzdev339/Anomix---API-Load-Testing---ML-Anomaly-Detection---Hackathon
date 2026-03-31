"""
Anomix ML Training — scikit-learn
-----------------------------------
Models:
  1. IsolationForest    → unsupervised anomaly detection
  2. GradientBoosting   → performance prediction (latency + error rate)

Usage:
    python -m apps.ml.train

Output:
    model/anomaly_model.pkl
    model/predictor_latency.pkl
    model/predictor_error.pkl
    model/scaler.pkl
"""
import os
import sys
import logging
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "model")


def generate_data(n=6000, seed=42):
    """
    Synthetic API performance dataset.

    Features:
        [load_level, prev_latency_ms, prev_error_rate, hour_of_day, is_weekend]

    Targets:
        latency_ms, error_rate
    """
    rng = np.random.default_rng(seed)

    load       = rng.uniform(1, 500, n)
    hour       = rng.integers(0, 24, n).astype(float)
    is_weekend = rng.choice([0.0, 1.0], n)

    # Latency grows with load; peak hours add pressure
    base_lat  = 40 + load * 0.9 + rng.normal(0, 15, n)
    peak      = np.where((hour >= 9) & (hour <= 18), 25, 0)
    latency   = np.clip(base_lat + peak, 5, 8000)

    # Error rate grows exponentially at high load
    base_err  = 0.3 + (load / 500) ** 2.2 * 35
    error     = np.clip(base_err + rng.normal(0, 1.5, n), 0, 100)

    # Inject 5 % anomalies
    idx = rng.choice(n, int(n * 0.05), replace=False)
    latency[idx] *= rng.uniform(4, 12, len(idx))
    error[idx]    = np.clip(error[idx] + rng.uniform(35, 80, len(idx)), 0, 100)

    prev_lat = np.roll(latency, 1);  prev_lat[0] = latency.mean()
    prev_err = np.roll(error,   1);  prev_err[0] = error.mean()

    X = np.column_stack([load, prev_lat, prev_err, hour, is_weekend])
    y_lat = latency
    y_err = error
    return X, y_lat, y_err


def train_and_save(model_dir=None):
    from sklearn.ensemble import IsolationForest, GradientBoostingRegressor
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_absolute_error
    import joblib

    out = os.path.abspath(model_dir or MODEL_DIR)
    os.makedirs(out, exist_ok=True)

    # ── Data ──────────────────────────────────────────────────────────────────
    log.info("Generating %d synthetic samples…", 6000)
    X, y_lat, y_err = generate_data(6000)

    scaler = StandardScaler()
    X_sc   = scaler.fit_transform(X)

    X_tr, X_te, yl_tr, yl_te, ye_tr, ye_te = train_test_split(
        X_sc, y_lat, y_err, test_size=0.2, random_state=42
    )

    # ── 1. Anomaly detector — IsolationForest ─────────────────────────────────
    log.info("Training IsolationForest anomaly detector…")
    iso = IsolationForest(
        n_estimators=200,
        contamination=0.05,   # 5 % anomalies expected
        max_features=1.0,
        random_state=42,
        n_jobs=-1,
    )
    iso.fit(X_sc)             # unsupervised — uses full dataset

    scores = iso.decision_function(X_sc)
    threshold = float(np.percentile(scores, 5))   # bottom 5 % = anomaly
    log.info("Anomaly threshold (decision score): %.4f", threshold)

    # ── 2. Latency predictor — GradientBoosting ───────────────────────────────
    log.info("Training latency predictor…")
    lat_model = GradientBoostingRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=5,
        subsample=0.8,
        random_state=42,
    )
    lat_model.fit(X_tr, yl_tr)
    lat_mae = mean_absolute_error(yl_te, lat_model.predict(X_te))
    log.info("Latency predictor — test MAE: %.2f ms", lat_mae)

    # ── 3. Error rate predictor ───────────────────────────────────────────────
    log.info("Training error rate predictor…")
    err_model = GradientBoostingRegressor(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=4,
        subsample=0.8,
        random_state=42,
    )
    err_model.fit(X_tr, ye_tr)
    err_mae = mean_absolute_error(ye_te, err_model.predict(X_te))
    log.info("Error predictor   — test MAE: %.2f %%", err_mae)

    # ── Save ──────────────────────────────────────────────────────────────────
    joblib.dump(iso,        os.path.join(out, "anomaly_model.pkl"))
    joblib.dump(lat_model,  os.path.join(out, "predictor_latency.pkl"))
    joblib.dump(err_model,  os.path.join(out, "predictor_error.pkl"))
    joblib.dump(scaler,     os.path.join(out, "scaler.pkl"))

    # Save threshold alongside
    np.save(os.path.join(out, "anomaly_threshold.npy"), np.array([threshold]))

    log.info("All models saved to: %s", out)
    log.info("  anomaly_model.pkl       — IsolationForest")
    log.info("  predictor_latency.pkl   — GradientBoosting (latency)")
    log.info("  predictor_error.pkl     — GradientBoosting (error rate)")
    log.info("  scaler.pkl              — StandardScaler")
    return out


if __name__ == "__main__":
    train_and_save(sys.argv[1] if len(sys.argv) > 1 else None)

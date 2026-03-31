"""
Anomix API Views
-----------------
Thin views — all heavy logic lives in service modules.

Endpoints:
  POST /api/test/           — Run a load test
  GET  /api/test/<id>/      — Get a single test result
  GET  /api/test/           — List all test results
  GET  /api/metrics/<id>/   — Detailed metrics for a result
  GET  /api/metrics/        — All recent metrics (paginated)
  POST /api/predict/        — Predict performance for a load level
  GET  /api/anomaly/        — All anomaly records
  GET  /api/anomaly/<id>/   — Anomalies for a specific test result
  GET  /api/ml/status/      — ML model readiness status
"""
import logging
from datetime import datetime, timezone

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.loadtest.models import LoadTestConfig, LoadTestResult
from apps.loadtest.serializers import LoadTestConfigSerializer, LoadTestResultSummarySerializer, LoadTestResultSerializer
from apps.loadtest.service import run_load_test
from apps.analytics.models import AnomalyRecord, PredictionRecord
from apps.analytics.serializers import AnomalyRecordSerializer, PredictionRecordSerializer, PredictionRequestSerializer
from apps.analytics.service import build_snapshots, get_metrics_for_result
from apps.ml.service import MLService

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Load Test
# ─────────────────────────────────────────────

@api_view(["GET", "POST"])
def test_list(request):
    if request.method == "GET":
        results = LoadTestResult.objects.select_related("config").all()[:100]
        return Response(LoadTestResultSummarySerializer(results, many=True).data)

    # POST — run a new load test
    config_serializer = LoadTestConfigSerializer(data=request.data)
    if not config_serializer.is_valid():
        return Response(config_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    config = config_serializer.save()
    result = LoadTestResult.objects.create(
        config=config,
        status="running",
        started_at=datetime.now(tz=timezone.utc),
    )

    try:
        metrics = run_load_test(config)
        for field, value in metrics.items():
            setattr(result, field, value)
        result.status = "completed"
        result.completed_at = datetime.now(tz=timezone.utc)
        result.save()

        # Build time-series snapshots
        build_snapshots(result)

        # Detect anomalies
        ml = MLService.instance()
        anomaly_dicts = ml.detect_anomalies(result)
        for ad in anomaly_dicts:
            AnomalyRecord.objects.create(test_result=result, **ad)

    except Exception as exc:
        logger.exception("Load test failed: %s", exc)
        result.status = "failed"
        result.error_messages = [str(exc)]
        result.completed_at = datetime.now(tz=timezone.utc)
        result.save()

    return Response(LoadTestResultSerializer(result).data, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
def test_delete(request, pk):
    try:
        result = LoadTestResult.objects.get(pk=pk)
        result.config.delete()  # cascades to result + snapshots + anomalies
        return Response(status=status.HTTP_204_NO_CONTENT)
    except LoadTestResult.DoesNotExist:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
def test_detail(request, pk):
    try:
        result = LoadTestResult.objects.select_related("config").get(pk=pk)
    except LoadTestResult.DoesNotExist:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    return Response(LoadTestResultSerializer(result).data)


# ─────────────────────────────────────────────
# Metrics
# ─────────────────────────────────────────────

@api_view(["GET"])
def metrics_list(request):
    """Returns the 20 most recent test result summaries with time-series data."""
    results = LoadTestResult.objects.filter(status="completed").select_related("config")[:20]
    data = [get_metrics_for_result(r) for r in results]
    return Response(data)


@api_view(["GET"])
def metrics_detail(request, pk):
    try:
        result = LoadTestResult.objects.select_related("config").get(pk=pk)
    except LoadTestResult.DoesNotExist:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    return Response(get_metrics_for_result(result))


# ─────────────────────────────────────────────
# Prediction
# ─────────────────────────────────────────────

@api_view(["POST"])
def predict(request):
    """
    Predict response time and failure probability for a given load level.
    Does NOT block on ML training — model must be pre-trained.
    """
    serializer = PredictionRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    load_level = data["load_level"]
    hist_latencies = data.get("historical_latencies", [])
    hist_errors = data.get("historical_error_rates", [])

    prev_latency = (sum(hist_latencies) / len(hist_latencies)) if hist_latencies else 200.0
    prev_error = (sum(hist_errors) / len(hist_errors)) if hist_errors else 2.0

    ml = MLService.instance()
    prediction = ml.predict_performance(load_level, prev_latency, prev_error)

    # Persist prediction record
    test_result_id = data.get("test_result_id")
    result_obj = None
    if test_result_id:
        try:
            result_obj = LoadTestResult.objects.get(pk=test_result_id)
        except LoadTestResult.DoesNotExist:
            pass

    record = PredictionRecord.objects.create(
        test_result=result_obj,
        load_level=load_level,
        predicted_latency_ms=prediction["predicted_latency_ms"],
        predicted_error_rate=prediction["predicted_error_rate"],
        failure_probability=prediction["failure_probability"],
        confidence_score=prediction["confidence_score"],
    )

    return Response({
        **prediction,
        "load_level": load_level,
        "record_id": record.pk,
    })


# ─────────────────────────────────────────────
# Anomaly
# ─────────────────────────────────────────────

@api_view(["GET"])
def anomaly_list(request):
    anomalies = AnomalyRecord.objects.select_related("test_result").all()[:200]
    return Response(AnomalyRecordSerializer(anomalies, many=True).data)


@api_view(["GET"])
def anomaly_for_result(request, pk):
    try:
        result = LoadTestResult.objects.get(pk=pk)
    except LoadTestResult.DoesNotExist:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    anomalies = result.anomalies.all()
    return Response(AnomalyRecordSerializer(anomalies, many=True).data)


# ─────────────────────────────────────────────
# ML Status
# ─────────────────────────────────────────────

@api_view(["GET"])
def ml_status(request):
    ml = MLService.instance()
    return Response({
        "model_loaded": ml.is_ready,
        "detection_method": "ml_autoencoder" if ml.is_ready else "statistical_fallback",
        "message": (
            "TensorFlow models are loaded and ready."
            if ml.is_ready
            else "Models not trained yet. Run `python -m apps.ml.train` to train. Using statistical fallback."
        ),
    })

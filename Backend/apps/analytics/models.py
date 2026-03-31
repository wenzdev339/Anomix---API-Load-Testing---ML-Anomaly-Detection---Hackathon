from django.db import models
from apps.loadtest.models import LoadTestResult


class MetricSnapshot(models.Model):
    """Per-second (or per-batch) metric snapshots for time-series analytics."""

    test_result = models.ForeignKey(
        LoadTestResult, on_delete=models.CASCADE, related_name="snapshots"
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    latency_ms = models.FloatField()
    throughput_rps = models.FloatField()
    error_rate = models.FloatField()
    request_index = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["timestamp"]

    def __str__(self):
        return f"Snapshot @ {self.timestamp} — latency={self.latency_ms}ms"


class AnomalyRecord(models.Model):
    """Record of a detected anomaly in a test result."""

    ANOMALY_TYPES = [
        ("latency_spike", "Latency Spike"),
        ("high_error_rate", "High Error Rate"),
        ("throughput_drop", "Throughput Drop"),
        ("general", "General Anomaly"),
    ]

    SEVERITY_LEVELS = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("critical", "Critical"),
    ]

    test_result = models.ForeignKey(
        LoadTestResult, on_delete=models.CASCADE, related_name="anomalies"
    )
    anomaly_type = models.CharField(max_length=50, choices=ANOMALY_TYPES)
    severity = models.CharField(max_length=20, choices=SEVERITY_LEVELS)
    score = models.FloatField(help_text="Anomaly score (higher = more anomalous)")
    detected_at = models.DateTimeField(auto_now_add=True)
    description = models.TextField()
    metric_value = models.FloatField(help_text="The metric value that triggered detection")
    threshold_value = models.FloatField(help_text="The threshold that was exceeded")

    class Meta:
        ordering = ["-detected_at"]

    def __str__(self):
        return f"{self.get_anomaly_type_display()} [{self.severity}] @ {self.detected_at}"


class PredictionRecord(models.Model):
    """ML prediction records for performance forecasting."""

    test_result = models.ForeignKey(
        LoadTestResult, on_delete=models.CASCADE, related_name="predictions", null=True, blank=True
    )
    predicted_at = models.DateTimeField(auto_now_add=True)
    load_level = models.PositiveIntegerField(help_text="Simulated concurrent users")
    predicted_latency_ms = models.FloatField()
    predicted_error_rate = models.FloatField()
    failure_probability = models.FloatField(
        help_text="Probability of failure (0–1)", default=0.0
    )
    confidence_score = models.FloatField(default=0.0)
    model_version = models.CharField(max_length=50, default="v1")

    class Meta:
        ordering = ["-predicted_at"]

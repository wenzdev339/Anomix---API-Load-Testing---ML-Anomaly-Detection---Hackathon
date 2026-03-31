from django.db import models


class LoadTestConfig(models.Model):
    """Configuration for a single load test run."""

    HTTP_METHODS = [
        ("GET", "GET"),
        ("POST", "POST"),
        ("PUT", "PUT"),
        ("DELETE", "DELETE"),
        ("PATCH", "PATCH"),
    ]

    url = models.URLField(max_length=2048)
    method = models.CharField(max_length=10, choices=HTTP_METHODS, default="GET")
    headers = models.JSONField(default=dict, blank=True)
    body = models.JSONField(null=True, blank=True)
    request_count = models.PositiveIntegerField(default=10)
    concurrency = models.PositiveIntegerField(default=1)
    timeout_seconds = models.PositiveIntegerField(default=30)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.method} {self.url} ({self.request_count} reqs)"


class LoadTestResult(models.Model):
    """Aggregated result of a completed load test."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    config = models.ForeignKey(
        LoadTestConfig, on_delete=models.CASCADE, related_name="results"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    total_requests = models.PositiveIntegerField(default=0)
    successful_requests = models.PositiveIntegerField(default=0)
    failed_requests = models.PositiveIntegerField(default=0)

    avg_latency_ms = models.FloatField(default=0.0)
    min_latency_ms = models.FloatField(default=0.0)
    max_latency_ms = models.FloatField(default=0.0)
    p50_latency_ms = models.FloatField(default=0.0)
    p95_latency_ms = models.FloatField(default=0.0)
    p99_latency_ms = models.FloatField(default=0.0)

    throughput_rps = models.FloatField(default=0.0)
    error_rate = models.FloatField(default=0.0)
    status_codes = models.JSONField(default=dict)

    raw_latencies = models.JSONField(default=list)
    error_messages = models.JSONField(default=list)

    # Sample body/headers captured from the first successful response
    sample_response_body = models.TextField(null=True, blank=True)
    sample_response_headers = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"Result #{self.pk} - {self.status} ({self.total_requests} reqs)"

    @property
    def duration_seconds(self):
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

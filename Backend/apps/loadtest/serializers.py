from rest_framework import serializers
from .models import LoadTestConfig, LoadTestResult


class LoadTestConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoadTestConfig
        fields = "__all__"
        read_only_fields = ["created_at"]

    def validate_request_count(self, value):
        if value < 1:
            raise serializers.ValidationError("request_count must be at least 1.")
        if value > 1000:
            raise serializers.ValidationError("request_count cannot exceed 1000.")
        return value

    def validate_concurrency(self, value):
        if value < 1:
            raise serializers.ValidationError("concurrency must be at least 1.")
        if value > 50:
            raise serializers.ValidationError("concurrency cannot exceed 50.")
        return value


class LoadTestResultSerializer(serializers.ModelSerializer):
    duration_seconds = serializers.ReadOnlyField()
    config = LoadTestConfigSerializer(read_only=True)

    class Meta:
        model = LoadTestResult
        fields = "__all__"
        read_only_fields = [
            "started_at",
            "completed_at",
            "total_requests",
            "successful_requests",
            "failed_requests",
            "avg_latency_ms",
            "min_latency_ms",
            "max_latency_ms",
            "p50_latency_ms",
            "p95_latency_ms",
            "p99_latency_ms",
            "throughput_rps",
            "error_rate",
            "status_codes",
            "raw_latencies",
            "error_messages",
            "sample_response_body",
            "sample_response_headers",
            "duration_seconds",
        ]


class LoadTestResultSummarySerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views — omits raw latencies."""

    duration_seconds = serializers.ReadOnlyField()
    config = LoadTestConfigSerializer(read_only=True)

    class Meta:
        model = LoadTestResult
        exclude = ["raw_latencies", "error_messages"]

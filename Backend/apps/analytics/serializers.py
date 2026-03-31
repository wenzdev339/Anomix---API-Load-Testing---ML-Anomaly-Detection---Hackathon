from rest_framework import serializers
from .models import MetricSnapshot, AnomalyRecord, PredictionRecord


class MetricSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetricSnapshot
        fields = "__all__"


class AnomalyRecordSerializer(serializers.ModelSerializer):
    anomaly_type_display = serializers.CharField(
        source="get_anomaly_type_display", read_only=True
    )
    severity_display = serializers.CharField(
        source="get_severity_display", read_only=True
    )

    class Meta:
        model = AnomalyRecord
        fields = "__all__"


class PredictionRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = PredictionRecord
        fields = "__all__"


class PredictionRequestSerializer(serializers.Serializer):
    load_level = serializers.IntegerField(min_value=1, max_value=10000)
    historical_latencies = serializers.ListField(
        child=serializers.FloatField(), required=False, default=list
    )
    historical_error_rates = serializers.ListField(
        child=serializers.FloatField(), required=False, default=list
    )
    test_result_id = serializers.IntegerField(required=False, allow_null=True)

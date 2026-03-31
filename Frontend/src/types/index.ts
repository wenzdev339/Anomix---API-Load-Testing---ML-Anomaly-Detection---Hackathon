export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type AuthType = "none" | "bearer" | "api_key" | "basic" | "oauth2";

export interface AuthConfig {
  type: AuthType;
  // bearer / oauth2 access token
  token?: string;
  // api_key
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyIn?: "header" | "query";
  // basic / digest username+password
  username?: string;
  password?: string;
  // oauth2 client credentials
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  grantType?: "client_credentials" | "password" | "bearer_token";
}

export interface Header {
  key: string;
  value: string;
  enabled: boolean;
}

export interface LoadTestConfig {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body: unknown | null;
  request_count: number;
  concurrency: number;
  timeout_seconds: number;
}

export interface LoadTestResult {
  id: number;
  config: LoadTestConfig & { id: number; created_at: string };
  status: "pending" | "running" | "completed" | "failed";
  started_at: string | null;
  completed_at: string | null;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_latency_ms: number;
  min_latency_ms: number;
  max_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  throughput_rps: number;
  error_rate: number;
  status_codes: Record<string, number>;
  raw_latencies: number[];
  error_messages: string[];
  sample_response_body: string | null;
  sample_response_headers: Record<string, string>;
  duration_seconds: number | null;
  anomalies?: AnomalyRecord[];
}

export interface TimeSeriesPoint {
  index: number;
  latency_ms: number;
  throughput_rps: number;
  error_rate: number;
}

export interface MetricsData {
  result_id: number;
  status: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_latency_ms: number;
  min_latency_ms: number;
  max_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  throughput_rps: number;
  error_rate: number;
  status_codes: Record<string, number>;
  duration_seconds: number | null;
  time_series: TimeSeriesPoint[];
  anomalies: AnomalyRecord[];
}

export interface AnomalyRecord {
  id: number;
  test_result: number;
  anomaly_type: "latency_spike" | "high_error_rate" | "throughput_drop" | "general";
  anomaly_type_display: string;
  severity: "low" | "medium" | "high" | "critical";
  severity_display: string;
  score: number;
  detected_at: string;
  description: string;
  metric_value: number;
  threshold_value: number;
}

export interface PredictionResult {
  predicted_latency_ms: number;
  predicted_error_rate: number;
  failure_probability: number;
  confidence_score: number;
  method: "ml" | "statistical";
  load_level: number;
  record_id: number;
}

export interface MLStatus {
  model_loaded: boolean;
  detection_method: string;
  message: string;
}

export interface RequestBuilderState {
  url: string;
  method: HttpMethod;
  headers: Header[];
  body: string;
  auth: AuthConfig;
  request_count: number;
  concurrency: number;
  timeout_seconds: number;
}

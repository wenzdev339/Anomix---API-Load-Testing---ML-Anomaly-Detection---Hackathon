import axios from "axios";
import type {
  LoadTestConfig, LoadTestResult, MetricsData,
  AnomalyRecord, PredictionResult, MLStatus,
} from "@/types";

const client = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 120_000,
});

client.interceptors.response.use(
  r => r,
  err => {
    const msg =
      err.response?.data?.detail ||
      err.response?.data?.error ||
      err.message ||
      "Unknown error";
    return Promise.reject(new Error(msg));
  }
);

export const api = {
  runTest:   (c: LoadTestConfig): Promise<LoadTestResult> =>
    client.post<LoadTestResult>("/test/", c).then(r => r.data),

  getTests:  (): Promise<LoadTestResult[]> =>
    client.get<LoadTestResult[]>("/test/").then(r => r.data),

  getTest:   (id: number): Promise<LoadTestResult> =>
    client.get<LoadTestResult>(`/test/${id}/`).then(r => r.data),

  deleteTest: (id: number): Promise<void> =>
    client.delete(`/test/${id}/delete/`).then(() => {}),

  getMetrics: (): Promise<MetricsData[]> =>
    client.get<MetricsData[]>("/metrics/").then(r => r.data),

  getMetricsForTest: (id: number): Promise<MetricsData> =>
    client.get<MetricsData>(`/metrics/${id}/`).then(r => r.data),

  predict: (p: {
    load_level: number;
    historical_latencies?: number[];
    historical_error_rates?: number[];
    test_result_id?: number;
  }): Promise<PredictionResult> =>
    client.post<PredictionResult>("/predict/", p).then(r => r.data),

  getAnomalies: (): Promise<AnomalyRecord[]> =>
    client.get<AnomalyRecord[]>("/anomaly/").then(r => r.data),

  getAnomaliesForTest: (id: number): Promise<AnomalyRecord[]> =>
    client.get<AnomalyRecord[]>(`/anomaly/${id}/`).then(r => r.data),

  getMlStatus: (): Promise<MLStatus> =>
    client.get<MLStatus>("/ml/status/").then(r => r.data),
};

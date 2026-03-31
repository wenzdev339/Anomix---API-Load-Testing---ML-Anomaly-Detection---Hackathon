import { useState, useCallback } from "react";
import { api } from "@/services/api";
import type { LoadTestResult, LoadTestConfig, RequestBuilderState, Header, AuthConfig } from "@/types";

function headersArrayToRecord(headers: Header[]): Record<string, string> {
  return headers
    .filter(h => h.enabled && h.key.trim())
    .reduce((acc, h) => ({ ...acc, [h.key.trim()]: h.value }), {} as Record<string, string>);
}

/** Inject auth config into header record */
function applyAuth(headers: Record<string, string>, auth: AuthConfig): Record<string, string> {
  const h = { ...headers };
  switch (auth.type) {
    case "bearer":
    case "oauth2":
      if (auth.token) h["Authorization"] = `Bearer ${auth.token}`;
      break;
    case "api_key":
      if (auth.apiKeyName && auth.apiKeyValue && auth.apiKeyIn === "header")
        h[auth.apiKeyName] = auth.apiKeyValue;
      break;
    case "basic":
      if (auth.username != null && auth.password != null) {
        const encoded = btoa(`${auth.username}:${auth.password}`);
        h["Authorization"] = `Basic ${encoded}`;
      }
      break;
    default:
      break;
  }
  return h;
}

function parseBody(raw: string): unknown | null {
  if (!raw.trim()) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

export function useLoadTest() {
  const [result,  setResult]  = useState<LoadTestResult | null>(null);
  const [history, setHistory] = useState<LoadTestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const runTest = useCallback(async (state: RequestBuilderState) => {
    setLoading(true);
    setError(null);

    const baseHeaders = headersArrayToRecord(state.headers);
    const finalHeaders = applyAuth(baseHeaders, state.auth);

    const config: LoadTestConfig = {
      url:             state.url,
      method:          state.method,
      headers:         finalHeaders,
      body:            parseBody(state.body),
      request_count:   state.request_count,
      concurrency:     state.concurrency,
      timeout_seconds: state.timeout_seconds,
    };

    try {
      const res = await api.runTest(config);
      setResult(res);
      setHistory(prev => [res, ...prev.filter(r => r.id !== res.id).slice(0, 49)]);
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const results = await api.getTests();
      setHistory(results);
    } catch {}
  }, []);

  const selectResult = useCallback((r: LoadTestResult) => setResult(r), []);

  const deleteResult = useCallback(async (id: number) => {
    try {
      await api.deleteTest(id);
      setHistory(prev => prev.filter(r => r.id !== id));
      setResult(prev => prev?.id === id ? null : prev);
    } catch {}
  }, []);

  return { result, history, loading, error, runTest, loadHistory, selectResult, deleteResult };
}

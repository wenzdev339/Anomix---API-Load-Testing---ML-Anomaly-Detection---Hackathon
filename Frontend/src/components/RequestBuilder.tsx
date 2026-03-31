import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import type { AuthConfig, AuthType, Header, HttpMethod, RequestBuilderState } from "@/types";

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH"];

const METHOD_COLOR: Record<HttpMethod, string> = {
  GET:    "text-pm-green",
  POST:   "text-pm-orange",
  PUT:    "text-pm-yellow",
  DELETE: "text-pm-red",
  PATCH:  "text-pm-blue",
};

type Tab = "params" | "auth" | "headers" | "body" | "load";

const DEFAULT_AUTH: AuthConfig = { type: "none" };

const DEFAULT_STATE: RequestBuilderState = {
  url: "https://jsonplaceholder.typicode.com/posts/1",
  method: "GET",
  headers: [{ key: "Accept", value: "application/json", enabled: true }],
  body: "",
  auth: DEFAULT_AUTH,
  request_count: 20,
  concurrency: 5,
  timeout_seconds: 30,
};

export function RequestBuilder({ onRun, loading }: {
  onRun: (s: RequestBuilderState) => void;
  loading: boolean;
}) {
  const [s, setS]   = useState<RequestBuilderState>(DEFAULT_STATE);
  const [tab, setTab] = useState<Tab>("load");
  const [fetchingToken, setFetchingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Keep a ref to state for the keyboard handler (avoids stale closure)
  const stateRef = useRef(s);
  stateRef.current = s;

  // Ctrl+Enter / Cmd+Enter → Send
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !loading) {
        e.preventDefault();
        const cur = stateRef.current;
        if (cur.url.trim()) onRun(cur);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loading, onRun]);

  const set = <K extends keyof RequestBuilderState>(k: K, v: RequestBuilderState[K]) =>
    setS(p => ({ ...p, [k]: v }));

  const setAuth = (partial: Partial<AuthConfig>) =>
    setS(p => ({ ...p, auth: { ...p.auth, ...partial } }));

  const setHeader = (i: number, f: keyof Header, v: string | boolean) => {
    const h = [...s.headers]; h[i] = { ...h[i], [f]: v }; set("headers", h);
  };

  const activeHeaders = useMemo(
    () => s.headers.filter(h => h.enabled && h.key.trim()).length,
    [s.headers]
  );
  const canBody = useMemo(() => ["POST", "PUT", "PATCH"].includes(s.method), [s.method]);
  const hasAuth = s.auth.type !== "none";

  const tabs = useMemo(() => [
    { id: "params"  as Tab, label: "Params" },
    { id: "auth"    as Tab, label: "Authorization", badge: hasAuth ? s.auth.type : undefined },
    { id: "headers" as Tab, label: "Headers",       badge: activeHeaders || undefined },
    { id: "body"    as Tab, label: "Body" },
    { id: "load"    as Tab, label: "Load Config" },
  ], [hasAuth, s.auth.type, activeHeaders]);

  const handleTabClick = useCallback((id: Tab) => setTab(id), []);

  /** OAuth2: fetch access token from token URL using client credentials */
  const fetchOAuthToken = async () => {
    const { tokenUrl, clientId, clientSecret, scope, grantType = "client_credentials" } = s.auth;
    if (!tokenUrl) { setTokenError("Token URL is required."); return; }

    setFetchingToken(true);
    setTokenError(null);
    try {
      const body = new URLSearchParams();
      body.append("grant_type", grantType);
      if (clientId)     body.append("client_id", clientId);
      if (clientSecret) body.append("client_secret", clientSecret);
      if (scope)        body.append("scope", scope);

      const resp = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const token = data.access_token ?? data.token;
      if (!token) throw new Error("No access_token in response");
      setAuth({ token: String(token) });
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : "Failed to fetch token");
    } finally {
      setFetchingToken(false);
    }
  };

  return (
    <div className="flex flex-col bg-pm-bg">

      {/* ── URL Bar ── */}
      <div className="flex items-stretch gap-0 px-3 py-2.5 border-b border-pm-divider">
        {/* Method selector */}
        <div className="relative shrink-0">
          <select
            value={s.method}
            onChange={e => set("method", e.target.value as HttpMethod)}
            className={clsx(
              "h-full appearance-none bg-pm-panel border border-r-0 border-pm-border",
              "rounded-l px-3 pr-6 text-sm font-bold font-mono cursor-pointer",
              "focus:outline-none focus:border-pm-orange transition-colors",
              METHOD_COLOR[s.method]
            )}
          >
            {METHODS.map(m => (
              <option key={m} value={m} className="bg-pm-bg text-pm-text font-normal">{m}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-pm-dim text-2xs">▾</span>
        </div>

        {/* URL input */}
        <input
          value={s.url}
          onChange={e => set("url", e.target.value)}
          placeholder="https://api.example.com/endpoint"
          className={clsx(
            "flex-1 bg-pm-input border border-pm-border px-3 py-2",
            "text-sm font-mono text-pm-text",
            "focus:outline-none focus:border-pm-orange transition-colors",
            "placeholder:text-pm-dim"
          )}
        />

        {/* Send button */}
        <button
          disabled={!s.url.trim() || loading}
          onClick={() => onRun(s)}
          title="Send request (Ctrl+Enter)"
          className={clsx(
            "shrink-0 px-6 rounded-r border border-l-0",
            "bg-pm-orange hover:bg-pm-orange-h border-pm-orange-d",
            "text-white font-semibold text-sm transition-colors",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "flex items-center gap-2"
          )}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Running
            </>
          ) : "Send"}
        </button>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex border-b border-pm-divider bg-pm-surface px-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => handleTabClick(t.id)}
            className={clsx("pm-tab", tab === t.id ? "pm-tab-on" : "pm-tab-off")}
          >
            {t.label}
            {t.badge != null && (
              <span className="ml-1.5 bg-pm-orange/20 text-pm-orange text-2xs rounded px-1.5 font-semibold">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="p-4 bg-pm-surface">

        {/* PARAMS */}
        {tab === "params" && (
          <p className="text-xs text-pm-muted italic">
            Query parameter support coming soon. Add params directly to the URL for now.
          </p>
        )}

        {/* AUTHORIZATION */}
        {tab === "auth" && (
          <div className="space-y-4">
            {/* Auth type selector */}
            <div className="max-w-xs">
              <label className="pm-label">Auth Type</label>
              <select
                value={s.auth.type}
                onChange={e => setAuth({ type: e.target.value as AuthType })}
                className="pm-input mt-1"
              >
                <option value="none">No Auth</option>
                <option value="bearer">Bearer Token</option>
                <option value="api_key">API Key</option>
                <option value="basic">Basic Auth</option>
                <option value="oauth2">OAuth 2.0</option>
              </select>
            </div>

            {/* No Auth */}
            {s.auth.type === "none" && (
              <p className="text-xs text-pm-muted">
                This request does not use any authentication.
              </p>
            )}

            {/* Bearer Token */}
            {s.auth.type === "bearer" && (
              <div className="space-y-2">
                <label className="pm-label">Token</label>
                <input
                  type="text"
                  value={s.auth.token ?? ""}
                  onChange={e => setAuth({ token: e.target.value })}
                  placeholder="Enter bearer token"
                  className="pm-input"
                />
                <p className="text-xs text-pm-dim">
                  Sent as: <span className="font-mono text-pm-muted">Authorization: Bearer &lt;token&gt;</span>
                </p>
              </div>
            )}

            {/* API Key */}
            {s.auth.type === "api_key" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="pm-label">Key Name</label>
                    <input
                      value={s.auth.apiKeyName ?? ""}
                      onChange={e => setAuth({ apiKeyName: e.target.value })}
                      placeholder="X-API-Key"
                      className="pm-input mt-1"
                    />
                  </div>
                  <div>
                    <label className="pm-label">Key Value</label>
                    <input
                      value={s.auth.apiKeyValue ?? ""}
                      onChange={e => setAuth({ apiKeyValue: e.target.value })}
                      placeholder="your-api-key"
                      className="pm-input mt-1"
                    />
                  </div>
                </div>
                <div className="max-w-xs">
                  <label className="pm-label">Add To</label>
                  <select
                    value={s.auth.apiKeyIn ?? "header"}
                    onChange={e => setAuth({ apiKeyIn: e.target.value as "header" | "query" })}
                    className="pm-input mt-1"
                  >
                    <option value="header">Request Header</option>
                    <option value="query">Query Params</option>
                  </select>
                </div>
                <p className="text-xs text-pm-dim">
                  {s.auth.apiKeyIn === "query"
                    ? "Note: API key in query params is not injected automatically. Add it directly to the URL."
                    : <>Sent as: <span className="font-mono text-pm-muted">{s.auth.apiKeyName || "X-API-Key"}: {s.auth.apiKeyValue || "value"}</span></>
                  }
                </p>
              </div>
            )}

            {/* Basic Auth */}
            {s.auth.type === "basic" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="pm-label">Username</label>
                    <input
                      value={s.auth.username ?? ""}
                      onChange={e => setAuth({ username: e.target.value })}
                      placeholder="username"
                      className="pm-input mt-1"
                    />
                  </div>
                  <div>
                    <label className="pm-label">Password</label>
                    <input
                      type="password"
                      value={s.auth.password ?? ""}
                      onChange={e => setAuth({ password: e.target.value })}
                      placeholder="password"
                      className="pm-input mt-1"
                    />
                  </div>
                </div>
                <p className="text-xs text-pm-dim">
                  Sent as: <span className="font-mono text-pm-muted">Authorization: Basic &lt;base64&gt;</span>
                </p>
              </div>
            )}

            {/* OAuth 2.0 */}
            {s.auth.type === "oauth2" && (
              <div className="space-y-4">
                {/* Access token (manual or auto-fetched) */}
                <div className="space-y-2">
                  <label className="pm-label">Access Token</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={s.auth.token ?? ""}
                      onChange={e => setAuth({ token: e.target.value })}
                      placeholder="Paste access token or use Get Token below"
                      className="pm-input"
                    />
                  </div>
                  {s.auth.token && (
                    <p className="text-xs text-pm-dim">
                      Sent as: <span className="font-mono text-pm-muted">Authorization: Bearer &lt;token&gt;</span>
                    </p>
                  )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-pm-divider"/>
                  <span className="text-2xs text-pm-dim uppercase tracking-wider">Client Credentials</span>
                  <div className="flex-1 h-px bg-pm-divider"/>
                </div>

                {/* Grant type */}
                <div className="max-w-xs">
                  <label className="pm-label">Grant Type</label>
                  <select
                    value={s.auth.grantType ?? "client_credentials"}
                    onChange={e => setAuth({ grantType: e.target.value as AuthConfig["grantType"] })}
                    className="pm-input mt-1"
                  >
                    <option value="client_credentials">Client Credentials</option>
                    <option value="password">Password</option>
                    <option value="bearer_token">Bearer Token (manual)</option>
                  </select>
                </div>

                {/* Token URL */}
                <div>
                  <label className="pm-label">Token URL</label>
                  <input
                    value={s.auth.tokenUrl ?? ""}
                    onChange={e => setAuth({ tokenUrl: e.target.value })}
                    placeholder="https://auth.example.com/oauth/token"
                    className="pm-input mt-1"
                  />
                </div>

                {/* Client ID + Secret */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="pm-label">Client ID</label>
                    <input
                      value={s.auth.clientId ?? ""}
                      onChange={e => setAuth({ clientId: e.target.value })}
                      placeholder="client_id"
                      className="pm-input mt-1"
                    />
                  </div>
                  <div>
                    <label className="pm-label">Client Secret</label>
                    <input
                      type="password"
                      value={s.auth.clientSecret ?? ""}
                      onChange={e => setAuth({ clientSecret: e.target.value })}
                      placeholder="client_secret"
                      className="pm-input mt-1"
                    />
                  </div>
                </div>

                {/* Scope */}
                <div className="max-w-sm">
                  <label className="pm-label">Scope (optional)</label>
                  <input
                    value={s.auth.scope ?? ""}
                    onChange={e => setAuth({ scope: e.target.value })}
                    placeholder="read write"
                    className="pm-input mt-1"
                  />
                </div>

                {/* Get Token button */}
                {(s.auth.grantType ?? "client_credentials") !== "bearer_token" && (
                  <div className="flex items-center gap-3">
                    <Button
                      variant="primary"
                      size="xs"
                      loading={fetchingToken}
                      onClick={fetchOAuthToken}
                      disabled={!s.auth.tokenUrl}
                    >
                      Get Token
                    </Button>
                    {tokenError && (
                      <span className="text-xs text-pm-red">{tokenError}</span>
                    )}
                    {s.auth.token && !tokenError && (
                      <span className="text-xs text-pm-green">Token acquired</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* HEADERS */}
        {tab === "headers" && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-[20px_1fr_1fr_20px] gap-2 px-1 mb-1">
              <div/>
              <p className="pm-label">Key</p>
              <p className="pm-label">Value</p>
              <div/>
            </div>
            {s.headers.map((h, i) => (
              <div key={i} className="grid grid-cols-[20px_1fr_1fr_20px] gap-2 items-center group">
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={e => setHeader(i, "enabled", e.target.checked)}
                  className="accent-pm-orange cursor-pointer"
                />
                <input
                  value={h.key}
                  placeholder="Key"
                  onChange={e => setHeader(i, "key", e.target.value)}
                  className={clsx("pm-input", !h.enabled && "opacity-40")}
                />
                <input
                  value={h.value}
                  placeholder="Value"
                  onChange={e => setHeader(i, "value", e.target.value)}
                  className={clsx("pm-input", !h.enabled && "opacity-40")}
                />
                <button
                  onClick={() => set("headers", s.headers.filter((_, j) => j !== i))}
                  className="text-pm-dim hover:text-pm-red transition-colors opacity-0 group-hover:opacity-100 text-sm text-center"
                >
                  x
                </button>
              </div>
            ))}
            <button
              onClick={() => set("headers", [...s.headers, { key: "", value: "", enabled: true }])}
              className="text-xs text-pm-muted hover:text-pm-orange transition-colors mt-2 flex items-center gap-1"
            >
              <span className="text-sm leading-none">+</span> Add Header
            </button>
          </div>
        )}

        {/* BODY */}
        {tab === "body" && (
          <div>
            {!canBody && (
              <div className="bg-pm-panel border border-pm-border rounded px-3 py-2 mb-3 text-xs text-pm-muted">
                Body is not available for {s.method} requests.
              </div>
            )}
            <textarea
              value={s.body}
              onChange={e => set("body", e.target.value)}
              disabled={!canBody}
              placeholder={'{\n  "key": "value"\n}'}
              rows={9}
              className="pm-input font-mono text-xs resize-y w-full disabled:opacity-30"
            />
          </div>
        )}

        {/* LOAD CONFIG */}
        {tab === "load" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {([
                { label: "Total Requests", key: "request_count"   as const, min: 1, max: 1000, hint: "max 1000" },
                { label: "Concurrency",    key: "concurrency"     as const, min: 1, max: 50,   hint: "max 50 workers" },
                { label: "Timeout (s)",    key: "timeout_seconds" as const, min: 1, max: 120,  hint: "per request" },
              ]).map(({ label, key, min, max, hint }) => (
                <div key={key}>
                  <label className="pm-label">{label}</label>
                  <input
                    type="number"
                    min={min}
                    max={max}
                    value={s[key] as number}
                    onChange={e => set(key, Math.max(min, parseInt(e.target.value) || min))}
                    className="pm-input mt-1"
                  />
                  <p className="text-2xs text-pm-dim mt-1">{hint}</p>
                </div>
              ))}
            </div>
            <div className="bg-pm-panel border border-pm-border rounded px-4 py-2.5 text-xs text-pm-muted">
              Will send{" "}
              <span className="text-pm-orange font-semibold">{s.request_count}</span> requests with{" "}
              <span className="text-pm-orange font-semibold">{s.concurrency}</span> concurrent workers
              , approx.{" "}
              <span className="text-pm-text">{Math.ceil(s.request_count / s.concurrency)}</span> rounds.
              External APIs are fully supported.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

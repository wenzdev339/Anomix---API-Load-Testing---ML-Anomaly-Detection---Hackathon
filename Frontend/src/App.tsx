import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "@/pages/Home";
import { api } from "@/services/api";

type BackendStatus = "checking" | "online" | "offline";

export default function App() {
  const [status, setStatus] = useState<BackendStatus>("checking");

  useEffect(() => {
    api.getMlStatus()
      .then(() => setStatus("online"))
      .catch(() => setStatus("offline"));
  }, []);

  const statusDot: Record<BackendStatus, string> = {
    checking: "bg-pm-yellow animate-pulse",
    online:   "bg-pm-green",
    offline:  "bg-pm-red",
  };


  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen bg-pm-bg text-pm-text overflow-hidden">

        {/* Top bar */}
        <header className="shrink-0 flex items-center justify-between bg-pm-surface border-b border-pm-divider px-4 h-10">

          {/* Left: brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-pm-orange flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd"
                    d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                    clipRule="evenodd"/>
                </svg>
              </div>
              <span className="text-sm font-semibold text-pm-text tracking-wide">Anomix</span>
            </div>

            <div className="h-4 w-px bg-pm-divider mx-1"/>

            <span className="text-xs text-pm-dim hidden sm:block">
              API Load Testing &amp; Anomaly Detection
            </span>
          </div>

          {/* Right: status + version */}
          <div className="flex items-center gap-1.5 text-xs text-pm-dim">
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot[status]}`}/>
          </div>

        </header>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <Routes>
            <Route path="*" element={<Home/>}/>
          </Routes>
        </div>

      </div>
    </BrowserRouter>
  );
}

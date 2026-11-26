"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { useWorkspace } from "@/components/WorkspaceContext";

/**
 * Global Sync Loader:
 * - Tracks all in-flight `/api/` fetch requests, workspace context loads, and route changes.
 * - Renders an indeterminate top sync bar immediately and a subtle floating
 *   "Syncing live data..." pill so users always know when data is loading or syncing.
 */
export function GlobalSyncLoader() {
  const pathname = usePathname();
  const { loading: authLoading } = useAuth();
  const { serverLoading, tournamentLoading } = useWorkspace();

  const [inFlight, setInFlight] = useState(0);
  const [routePulse, setRoutePulse] = useState(false);
  const [showPill, setShowPill] = useState(false);
  const activeCountRef = useRef(0);

  // Brief route-transition bar pulse on pathname changes
  useEffect(() => {
    setRoutePulse(true);
    const t = window.setTimeout(() => setRoutePulse(false), 320);
    return () => window.clearTimeout(t);
  }, [pathname]);

  // Intercept client-side `/api/` fetches to reflect real network sync activity
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.fetch !== "function") {
      return;
    }
    const originalFetch = window.fetch.bind(window);

    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const urlStr =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      const isApi =
        urlStr.startsWith("/api/") ||
        urlStr.includes(`${window.location.origin}/api/`);

      if (!isApi) {
        return originalFetch(input, init);
      }

      activeCountRef.current += 1;
      setInFlight(activeCountRef.current);
      try {
        return await originalFetch(input, init);
      } finally {
        activeCountRef.current = Math.max(0, activeCountRef.current - 1);
        setInFlight(activeCountRef.current);
      }
    };

    window.fetch = wrappedFetch;
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const isSyncing =
    inFlight > 0 || authLoading || serverLoading || tournamentLoading;
  const showBar = isSyncing || routePulse;

  // Delay floating pill slightly (150ms) to prevent micro-flicker on instant hits
  useEffect(() => {
    if (!isSyncing) {
      setShowPill(false);
      return;
    }
    const timer = window.setTimeout(() => setShowPill(true), 150);
    return () => window.clearTimeout(timer);
  }, [isSyncing]);

  if (!showBar && !showPill) return null;

  return (
    <>
      {showBar && (
        <div
          role="progressbar"
          aria-label="Syncing tournament data"
          className="pointer-events-none fixed left-0 right-0 top-0 z-[95] h-[3px] overflow-hidden bg-slate-900/80"
        >
          <div className="sse-sync-bar h-full w-2/5 rounded-full bg-indigo-500 shadow-[0_0_12px_var(--accent-glow)]" />
        </div>
      )}

      {showPill && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-20 right-4 z-[90] lg:bottom-5"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-[#0d111a]/95 px-3.5 py-1.5 text-[11px] font-bold text-slate-200 shadow-xl backdrop-blur-md">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-400" />
            <span>Syncing live data...</span>
          </div>
        </div>
      )}
    </>
  );
}

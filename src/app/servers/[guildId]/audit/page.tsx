"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ChevronDown,
  Globe,
  RefreshCw,
  ScrollText,
  Search,
  Terminal,
} from "lucide-react";
import { ServerGuard } from "@/components/ServerGuard";
import { useWorkspace } from "@/components/WorkspaceContext";
import type { AuditLogRow } from "@/lib/tournament-types";

export default function ServerAuditLogsPage() {
  const params = useParams<{ guildId: string }>();
  const guildId = decodeURIComponent(params.guildId || "");
  const { serverData } = useWorkspace();

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/servers/${encodeURIComponent(guildId)}/audit?limit=100`,
        { cache: "no-store", credentials: "include" }
      );
      if (res.ok) {
        const j = await res.json();
        setLogs(j.logs || []);
      }
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    if (serverData?.access.canViewStaffTools) loadLogs();
  }, [serverData, loadLogs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (category !== "all" && !log.action.toLowerCase().startsWith(category)) {
        return false;
      }
      if (!q) return true;
      return (
        log.action.toLowerCase().includes(q) ||
        log.actorId.toLowerCase().includes(q) ||
        log.targetType.toLowerCase().includes(q) ||
        log.targetId.toLowerCase().includes(q)
      );
    });
  }, [logs, category, search]);

  return (
    <ServerGuard guildId={guildId} requireStaff>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
              Server Audit Logs
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Immutable administrative timeline combining Discord slash commands
              and Web Dashboard actions.
            </p>
          </div>
          <button
            type="button"
            onClick={loadLogs}
            className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-200 hover:border-indigo-500 sm:self-center"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, actor ID, or target ID..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: "all", label: "All" },
              { id: "tournament", label: "Tournaments" },
              { id: "match", label: "Matches" },
              { id: "squadpower", label: "Squad Power" },
              { id: "game", label: "Games" },
              { id: "support", label: "Tickets" },
              { id: "server", label: "Settings" },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setCategory(pill.id)}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  category === pill.id
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-800 bg-slate-950 text-slate-300 hover:border-indigo-500/50"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* Logs Timeline */}
        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-16 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-12 text-center">
            <ScrollText className="mx-auto mb-3 h-10 w-10 text-slate-500" />
            <h2 className="text-base font-bold text-white">No Audit Records</h2>
            <p className="mt-1 text-xs text-slate-400">
              Actions taken in this server will be recorded here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((entry) => {
              const isWeb = entry.details?.source === "web_dashboard";
              const isOpen = expandedId === entry.id;
              return (
                <div
                  key={entry.id}
                  className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : entry.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-800/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="font-mono text-xs font-extrabold text-indigo-300">
                          {entry.action}
                        </code>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isWeb
                              ? "bg-indigo-500/15 text-indigo-300"
                              : "bg-emerald-500/15 text-emerald-300"
                          }`}
                        >
                          {isWeb ? (
                            <Globe className="h-2.5 w-2.5" />
                          ) : (
                            <Terminal className="h-2.5 w-2.5" />
                          )}
                          {isWeb ? "Web" : "Discord"}
                        </span>
                        {entry.targetType && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
                            {entry.targetType}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span>
                          Actor:{" "}
                          <code className="font-mono text-slate-300">
                            {entry.actorId}
                          </code>
                        </span>
                        {entry.targetId && (
                          <span>
                            · Target:{" "}
                            <code className="font-mono text-slate-300">
                              {entry.targetId.slice(-10)}
                            </code>
                          </span>
                        )}
                        {entry.createdAt && (
                          <span>
                            · {new Date(entry.createdAt).toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-800 bg-slate-950/70 p-4">
                      <pre className="overflow-x-auto font-mono text-[11px] text-slate-300">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ServerGuard>
  );
}

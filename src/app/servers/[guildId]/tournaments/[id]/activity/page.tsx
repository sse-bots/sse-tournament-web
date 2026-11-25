"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
  Globe,
  Lock,
  Search,
  Terminal,
} from "lucide-react";
import { useTournamentDetail } from "@/components/TournamentDetailContext";

export default function TournamentActivityPage() {
  const { data } = useTournamentDetail();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const logs = useMemo(() => data?.auditLogs || [], [data?.auditLogs]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (a) =>
        a.action.toLowerCase().includes(q) ||
        a.actorId.toLowerCase().includes(q) ||
        a.targetType.toLowerCase().includes(q) ||
        a.targetId.toLowerCase().includes(q)
    );
  }, [logs, search]);

  if (!data) return null;
  const isStaff =
    data.access.canManageTournament || data.access.canAssignModerators;

  if (!isStaff) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-amber-500/40 bg-slate-900/75 p-8 text-center">
        <Lock className="mx-auto mb-3 h-9 w-9 text-amber-400" />
        <h2 className="text-base font-extrabold text-white">Staff Only</h2>
        <p className="mt-1.5 text-xs text-slate-400">
          Tournament activity logs are visible only to the Owner and assigned
          Moderators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activity action, actor ID, or record ID..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-12 text-center">
          <Activity className="mx-auto mb-3 h-10 w-10 text-slate-500" />
          <h3 className="text-sm font-bold text-white">No Activity Yet</h3>
          <p className="mt-1 text-xs text-slate-400">
            Approvals, match updates, and configuration changes appear here.
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
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-800/40"
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
                    <div className="mt-1 text-[11px] text-slate-400">
                      Actor <code className="font-mono text-slate-300">{entry.actorId}</code>
                      {entry.createdAt
                        ? ` · ${new Date(entry.createdAt).toLocaleString("en-IN")}`
                        : ""}
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
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Copy,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
} from "lucide-react";
import { ServerGuard } from "@/components/ServerGuard";
import { TournamentCard } from "@/components/TournamentCard";
import { useWorkspace } from "@/components/WorkspaceContext";
import { TOURNAMENT_TEMPLATES } from "@/lib/tournament-templates";
import {
  FORMAT_LABELS,
  STATUS_META,
  type TournamentFormat,
  type TournamentStatus,
  type TournamentSummary,
} from "@/lib/tournament-types";

export default function ServerTournamentsPage() {
  const params = useParams<{ guildId: string }>();
  const guildId = decodeURIComponent(params.guildId || "");
  const { serverData } = useWorkspace();

  const [items, setItems] = useState<TournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [format, setFormat] = useState<string>("all");
  const [mode, setMode] = useState<string>("all");
  const [includeArchived, setIncludeArchived] = useState(false);

  const access = serverData?.access;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      if (status !== "all") sp.set("status", status);
      if (format !== "all") sp.set("format", format);
      if (mode !== "all") sp.set("mode", mode);
      if (includeArchived || status === "archived") {
        sp.set("includeArchived", "true");
      }
      const res = await fetch(
        `/api/servers/${encodeURIComponent(guildId)}/tournaments?${sp.toString()}`,
        { cache: "no-store", credentials: "include" }
      );
      if (res.ok) {
        const j = await res.json();
        setItems(j.tournaments || []);
      }
    } finally {
      setLoading(false);
    }
  }, [guildId, q, status, format, mode, includeArchived]);

  useEffect(() => {
    if (!serverData) return;
    const t = window.setTimeout(load, 180);
    return () => window.clearTimeout(t);
  }, [serverData, load]);

  return (
    <ServerGuard guildId={guildId}>
      {access && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
                Server Tournaments
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                {access.canCreateTournament
                  ? "Create new tournaments from templates or blank, assign Moderator roles, and manage active brackets."
                  : access.isServerModerator
                    ? "Open any tournament where you hold a Moderator role to review proofs, manage matches, and declare winners."
                    : "Explore all tournaments in this server. Click any event to inspect live brackets, standings, and teams."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-200 transition hover:border-indigo-500"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
              {access.canCreateTournament && (
                <Link
                  href={`/servers/${guildId}/tournaments/new`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500"
                >
                  <Plus className="h-4 w-4" />
                  Create Tournament
                </Link>
              )}
            </div>
          </div>

          {/* Role Guidance Callout */}
          {!access.canCreateTournament && (
            <div
              className={`flex items-center gap-3 rounded-2xl border p-3.5 text-xs ${
                access.isServerModerator
                  ? "border-indigo-500/35 bg-indigo-500/10 text-indigo-300"
                  : "border-slate-800 bg-slate-900/60 text-slate-300"
              }`}
            >
              {access.isServerModerator ? (
                <ShieldCheck className="h-4 w-4 shrink-0 text-indigo-400" />
              ) : (
                <User className="h-4 w-4 shrink-0 text-slate-400" />
              )}
              <span>
                {access.isServerModerator
                  ? "You have Moderator access in this server. Only the Server Owner can create new tournaments, while you unlock full admin controls inside tournaments assigned to your Discord role."
                  : "You are viewing this server as a Member. Only the Server Owner can create tournaments — open any tournament below to track live matches, brackets, and standings."}
              </span>
            </div>
          )}

          {/* Filter Bar */}
          <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search tournament name..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">All Active Statuses</option>
                {(Object.keys(STATUS_META) as TournamentStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">All Formats</option>
                {(Object.keys(FORMAT_LABELS) as TournamentFormat[]).map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABELS[f]}
                  </option>
                ))}
              </select>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">Solo &amp; Team Modes</option>
                <option value="individual">Solo / Individual</option>
                <option value="team">Team / Squad</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <Trophy className="h-3.5 w-3.5 text-indigo-400" />
                Showing <strong className="text-white">{items.length}</strong>{" "}
                tournament{items.length === 1 ? "" : "s"}
              </span>

              <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="h-3.5 w-3.5 accent-indigo-500"
                />
                Include archived tournaments
              </label>
            </div>
          </div>

          {/* Tournament Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-60 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900/60 p-8 text-center">
              <div>
                <Filter className="mx-auto mb-2.5 h-9 w-9 text-slate-500" />
                <h2 className="text-base font-extrabold text-white">
                  No Tournaments Found
                </h2>
                <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
                  {q || status !== "all" || format !== "all" || mode !== "all"
                    ? "Try adjusting or clearing your filters."
                    : access.canCreateTournament
                      ? "Launch your first tournament with a ready-made game template or start blank."
                      : "This server doesn't have any active tournaments yet."}
                </p>
              </div>

              {access.canCreateTournament &&
                !q &&
                status === "all" &&
                format === "all" &&
                mode === "all" && (
                  <div className="mx-auto max-w-3xl space-y-3 border-t border-slate-800/80 pt-5 text-left">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-300">
                        <Sparkles className="h-3.5 w-3.5" />
                        Quick Launch from Template
                      </span>
                      <Link
                        href={`/servers/${guildId}/tournaments/new?template=blank`}
                        className="text-xs font-bold text-slate-300 hover:text-white hover:underline"
                      >
                        Or start Blank →
                      </Link>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {TOURNAMENT_TEMPLATES.filter((t) => !t.isBlank)
                        .slice(0, 3)
                        .map((tpl) => (
                          <Link
                            key={tpl.id}
                            href={`/servers/${guildId}/tournaments/new?template=${encodeURIComponent(tpl.id)}`}
                            className="rounded-2xl border border-slate-800 bg-slate-950/75 p-3.5 transition hover:border-indigo-500/60"
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className="h-2 w-8 rounded-full"
                                style={{ backgroundColor: tpl.accent }}
                              />
                              <span className="text-[10px] font-bold text-slate-400">
                                {tpl.gameHint}
                              </span>
                            </div>
                            <div className="mt-2 text-xs font-extrabold text-white">
                              {tpl.name}
                            </div>
                            <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                              {tpl.tagline}
                            </p>
                          </Link>
                        ))}
                    </div>
                  </div>
                )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => (
                <div key={t.id} className="relative flex flex-col">
                  <TournamentCard
                    tournament={t}
                    href={`/servers/${guildId}/tournaments/${t.id}`}
                    manageHref={
                      access.canViewStaffTools
                        ? `/servers/${guildId}/tournaments/${t.id}/settings`
                        : undefined
                    }
                  />
                  {access.canCreateTournament && (
                    <Link
                      href={`/servers/${guildId}/tournaments/new?cloneFrom=${encodeURIComponent(t.id)}`}
                      title="Clone tournament settings into a new draft"
                      className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2 py-1 text-[10px] font-bold text-slate-300 opacity-0 transition hover:border-indigo-500 hover:text-white group-hover:opacity-100 focus:opacity-100"
                    >
                      <Copy className="h-2.5 w-2.5" />
                      Clone
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </ServerGuard>
  );
}

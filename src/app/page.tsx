"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Trophy,
  PlusCircle,
  Swords,
  Users,
  Gamepad2,
  ArrowRight,
  Search,
  Sparkles,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { TournamentDTO, TournamentStatus } from "@/lib/types";
import { useArena } from "@/components/theme-provider";
import { TournamentStatusBadge, FormatBadge } from "@/components/ui/badges";

const FILTER_TABS: Array<{ key: "all" | TournamentStatus; label: string }> = [
  { key: "all", label: "All Active" },
  { key: "in_progress", label: "Live Now" },
  { key: "registration", label: "Open Registration" },
  { key: "draft", label: "Drafts" },
  { key: "completed", label: "Completed" },
];

export default function ArenaHomePage() {
  const { activeGuildId } = useArena();
  const [tournaments, setTournaments] = useState<TournamentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | TournamentStatus>("all");
  const [query, setQuery] = useState("");

  const loadTournaments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeGuildId) params.set("guildId", activeGuildId);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/tournaments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTournaments(data.tournaments || []);
      }
    } finally {
      setLoading(false);
    }
  }, [activeGuildId, statusFilter]);

  useEffect(() => {
    loadTournaments();
  }, [loadTournaments]);

  const visible = tournaments.filter((t) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      (t.gameName || "").toLowerCase().includes(q) ||
      t.format.toLowerCase().includes(q)
    );
  });

  const liveCount = tournaments.filter((t) => t.status === "in_progress").length;
  const openCount = tournaments.filter((t) => t.status === "registration").length;
  const totalPlayers = tournaments.reduce((acc, t) => acc + (t.counts?.registrations || 0), 0);
  const pendingQueue = tournaments.reduce(
    (acc, t) =>
      acc +
      (t.counts?.pendingPower || 0) +
      (t.counts?.pendingReviews || 0) +
      (t.counts?.disputed || 0),
    0
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      {/* Broadcast Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--arena-border)] bg-[var(--arena-surface)] p-6 sm:p-10 shadow-arena">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-500">
              <Sparkles className="h-3.5 w-3.5" />
              Competitive Esports Hub • Synced with Discord Bot
            </div>
            <h1 className="font-display-caps text-3xl sm:text-5xl font-extrabold leading-[1.08]">
              BUILD BRACKETS. <span className="text-amber-500">VERIFY PROOF.</span> CROWN CHAMPIONS.
            </h1>
            <p className="text-sm sm:text-base text-[var(--arena-muted)]">
              Draft and publish Mech Arena, Free Fire, Minecraft, or multi-day MAQC-style series with
              automatic Squad Power brackets, team rosters, private match posts, and frozen podium leaderboards.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/tournaments/new" className="arena-btn-primary shadow-glowGold">
                <PlusCircle className="h-4 w-4" />
                Create Tournament Draft
              </Link>
              <Link href="/games" className="arena-btn-secondary">
                <Gamepad2 className="h-4 w-4" />
                Manage Games
              </Link>
            </div>
          </div>

          {/* Live Telemetry Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 shrink-0">
            <div className="rounded-xl border border-[var(--arena-border)] bg-[var(--arena-elevated)]/80 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--arena-muted)]">
                Live Arenas
              </div>
              <div className="font-display-caps text-2xl font-extrabold text-red-500 mt-0.5">
                {liveCount}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--arena-border)] bg-[var(--arena-elevated)]/80 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--arena-muted)]">
                Open Reg
              </div>
              <div className="font-display-caps text-2xl font-extrabold text-emerald-500 mt-0.5">
                {openCount}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--arena-border)] bg-[var(--arena-elevated)]/80 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--arena-muted)]">
                Competitors
              </div>
              <div className="font-display-caps text-2xl font-extrabold text-cyan-500 mt-0.5">
                {totalPlayers}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--arena-border)] bg-[var(--arena-elevated)]/80 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--arena-muted)]">
                Review Queue
              </div>
              <div className="font-display-caps text-2xl font-extrabold text-amber-500 mt-0.5">
                {pendingQueue}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wider border transition-colors ${
                statusFilter === tab.key
                  ? "border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "border-[var(--arena-border)] bg-[var(--arena-surface)] text-[var(--arena-muted)] hover:text-[var(--arena-text)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--arena-muted)]" />
          <input
            className="arena-input pl-9"
            placeholder="Search tournaments or games..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tournament Cards Grid */}
      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="arena-card h-56 animate-pulse bg-[var(--arena-elevated)]/50" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="arena-card p-12 text-center space-y-3">
          <Trophy className="mx-auto h-10 w-10 text-amber-500/70" />
          <h2 className="font-display-caps text-xl font-bold">No Tournaments Found</h2>
          <p className="text-sm text-[var(--arena-muted)] max-w-md mx-auto">
            Create a new tournament in Draft mode, configure your Squad Power brackets and maps, then publish it to open registration.
          </p>
          <Link href="/tournaments/new" className="arena-btn-primary mt-2">
            <PlusCircle className="h-4 w-4" /> Create First Draft
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => {
            const reviews = (t.counts?.pendingPower || 0) + (t.counts?.pendingReviews || 0) + (t.counts?.disputed || 0);
            return (
              <Link
                key={t._id}
                href={`/tournaments/${t._id}`}
                className="arena-card group overflow-hidden flex flex-col justify-between hover:border-amber-500/70 transition-all shadow-arena"
              >
                <div>
                  {/* Game Strip */}
                  <div className="flex items-center justify-between border-b border-[var(--arena-border)] bg-[var(--arena-elevated)]/70 px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-500 truncate">
                      <Gamepad2 className="h-3.5 w-3.5 shrink-0" />
                      {t.gameName || "Game"}
                    </span>
                    <TournamentStatusBadge status={t.status} />
                  </div>

                  <div className="p-5 space-y-3">
                    <div>
                      <h3 className="font-display-caps text-xl font-bold group-hover:text-amber-500 transition-colors line-clamp-1">
                        {t.name}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--arena-muted)] line-clamp-2 min-h-[2rem]">
                        {t.description || "Official SSE competitive event."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <FormatBadge format={t.format} />
                      <span className="inline-flex items-center rounded-md border border-[var(--arena-border)] bg-[var(--arena-elevated)] px-2 py-0.5 text-[11px] font-semibold uppercase">
                        {t.mode === "team" ? `Teams ${t.teamSizeMin}-${t.teamSizeMax}` : "Solo"}
                      </span>
                      <span className="inline-flex items-center rounded-md border border-[var(--arena-border)] bg-[var(--arena-elevated)] px-2 py-0.5 text-[11px] font-semibold uppercase">
                        {t.scoring.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                      <div className="rounded-lg bg-[var(--arena-elevated)] py-2">
                        <div className="font-mono text-sm font-bold">{t.counts?.registrations || 0}</div>
                        <div className="text-[10px] uppercase text-[var(--arena-muted)] flex items-center justify-center gap-1">
                          <Users className="h-3 w-3" /> Players
                        </div>
                      </div>
                      <div className="rounded-lg bg-[var(--arena-elevated)] py-2">
                        <div className="font-mono text-sm font-bold">{t.counts?.matches || 0}</div>
                        <div className="text-[10px] uppercase text-[var(--arena-muted)] flex items-center justify-center gap-1">
                          <Swords className="h-3 w-3" /> Matches
                        </div>
                      </div>
                      <div className="rounded-lg bg-[var(--arena-elevated)] py-2">
                        <div className="font-mono text-sm font-bold">
                          {t.bracketsEnabled ? t.brackets.length : "Open"}
                        </div>
                        <div className="text-[10px] uppercase text-[var(--arena-muted)] flex items-center justify-center gap-1">
                          <Layers className="h-3 w-3" /> Brackets
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[var(--arena-border)] px-5 py-3 flex items-center justify-between text-xs">
                  {reviews > 0 ? (
                    <span className="flex items-center gap-1.5 font-semibold text-amber-500">
                      <AlertTriangle className="h-3.5 w-3.5" /> {reviews} pending review
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-[var(--arena-muted)]">
                      Server {t.guildId.slice(-6)}
                    </span>
                  )}
                  <span className="flex items-center gap-1 font-bold text-amber-500 group-hover:translate-x-1 transition-transform">
                    Enter Arena <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

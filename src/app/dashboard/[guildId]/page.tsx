"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  PlusCircle,
  Gamepad2,
  Trophy,
  Swords,
  Users,
  Layers,
  Search,
  AlertTriangle,
  ArrowRight,
  Bot,
  ExternalLink,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { useArena } from "@/components/theme-provider";
import { TournamentDTO, TournamentStatus } from "@/lib/types";
import type { ServerStatusInfo } from "@/lib/server-status";
import { TournamentStatusBadge, FormatBadge } from "@/components/ui/badges";

const FILTER_TABS: Array<{ key: "all" | TournamentStatus; label: string }> = [
  { key: "all", label: "All Active" },
  { key: "in_progress", label: "Live" },
  { key: "registration", label: "Open Reg" },
  { key: "draft", label: "Drafts" },
  { key: "completed", label: "Completed" },
];

function ServerWorkspaceContent() {
  const params = useParams<{ guildId: string }>();
  const guildId = params.guildId;
  const { setActiveGuildId } = useArena();

  const [server, setServer] = useState<ServerStatusInfo | null>(null);
  const [inviteUrl, setInviteUrl] = useState("https://sse-nexus.vercel.app");
  const [nexusUrl, setNexusUrl] = useState("https://sse-nexus.vercel.app");
  const [tournaments, setTournaments] = useState<TournamentDTO[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | TournamentStatus>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (guildId) setActiveGuildId(guildId);
  }, [guildId, setActiveGuildId]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const tParams = new URLSearchParams({ guildId });
      if (statusFilter !== "all") tParams.set("status", statusFilter);

      const [srvRes, tRes] = await Promise.all([
        fetch(`/api/servers?checkGuildId=${encodeURIComponent(guildId)}`),
        fetch(`/api/tournaments?${tParams.toString()}`),
      ]);

      if (srvRes.ok) {
        const sData = await srvRes.json();
        setServer(sData.servers?.[0] || null);
        if (sData.botInviteUrl) setInviteUrl(sData.botInviteUrl);
        if (sData.nexusUrl) setNexusUrl(sData.nexusUrl);
      }
      if (tRes.ok) {
        const tData = await tRes.json();
        setTournaments(tData.tournaments || []);
      }
    } finally {
      setLoading(false);
    }
  }, [guildId, statusFilter]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-[var(--arena-muted)]">
        Verifying bot connection & loading server arena...
      </div>
    );
  }

  // Gate if bot is not installed or not activated in this server
  if (server && server.readiness !== "active") {
    return (
      <div className="mx-auto max-w-lg px-4 py-14 space-y-4">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--arena-muted)] hover:text-amber-500">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Server Picker
        </Link>
        <div className="arena-card p-6 sm:p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/15 text-amber-500">
            <Bot className="h-7 w-7" />
          </div>
          <h1 className="font-display-caps text-2xl font-extrabold">{server.name}</h1>
          <p className="text-xs sm:text-sm text-[var(--arena-muted)]">
            {server.readiness === "not_installed"
              ? "SSE Tournament Bot is not installed in this server yet. Invite the bot first to unlock the web arena."
              : "SSE Tournament Bot is installed, but this server is not activated yet. Activate it using an SSE Nexus key."}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-2.5 pt-2">
            {server.readiness === "not_installed" ? (
              <a href={inviteUrl} target="_blank" rel="noreferrer" className="arena-btn-primary text-xs">
                Invite Bot <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <a href={nexusUrl} target="_blank" rel="noreferrer" className="arena-btn-primary text-xs">
                <KeyRound className="h-3.5 w-3.5" /> Activate via SSE Nexus <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button type="button" onClick={loadWorkspace} className="arena-btn-secondary text-xs">
              Re-check Status
            </button>
          </div>
        </div>
      </div>
    );
  }

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
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
      {/* Server Header */}
      <div className="arena-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--arena-muted)] hover:text-amber-500">
            <ArrowLeft className="h-3.5 w-3.5" /> All Servers
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5" /> Bot Active
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="font-display-caps text-2xl sm:text-3xl font-extrabold">
              {server?.name || `Server ${guildId.slice(-6)}`}
            </h1>
            <p className="font-mono text-xs text-[var(--arena-muted)] mt-0.5">
              Guild ID: {guildId} {!server?.setupComplete && "• Tip: Run /setup in Discord to auto-create base channels"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/tournaments/new?guildId=${encodeURIComponent(guildId)}`} className="arena-btn-primary text-xs shadow-glowGold flex-1 sm:flex-none">
              <PlusCircle className="h-4 w-4" /> Create Draft
            </Link>
            <Link href="/games" className="arena-btn-secondary text-xs flex-1 sm:flex-none">
              <Gamepad2 className="h-4 w-4" /> Games
            </Link>
          </div>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[var(--arena-border)]">
          <div className="rounded-xl bg-[var(--arena-elevated)] px-3.5 py-2.5">
            <div className="text-[10px] font-bold uppercase text-[var(--arena-muted)]">Live Arenas</div>
            <div className="font-display-caps text-xl font-extrabold text-red-500">{liveCount}</div>
          </div>
          <div className="rounded-xl bg-[var(--arena-elevated)] px-3.5 py-2.5">
            <div className="text-[10px] font-bold uppercase text-[var(--arena-muted)]">Open Reg</div>
            <div className="font-display-caps text-xl font-extrabold text-emerald-500">{openCount}</div>
          </div>
          <div className="rounded-xl bg-[var(--arena-elevated)] px-3.5 py-2.5">
            <div className="text-[10px] font-bold uppercase text-[var(--arena-muted)]">Competitors</div>
            <div className="font-display-caps text-xl font-extrabold text-cyan-500">{totalPlayers}</div>
          </div>
          <div className="rounded-xl bg-[var(--arena-elevated)] px-3.5 py-2.5">
            <div className="text-[10px] font-bold uppercase text-[var(--arena-muted)]">Review Queue</div>
            <div className="font-display-caps text-xl font-extrabold text-amber-500">{pendingQueue}</div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex overflow-x-auto gap-1.5 pb-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider border ${
                statusFilter === tab.key
                  ? "border-amber-500 bg-amber-500/15 text-amber-500"
                  : "border-[var(--arena-border)] bg-[var(--arena-surface)] text-[var(--arena-muted)]"
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
            placeholder="Search tournaments..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tournaments Grid */}
      {visible.length === 0 ? (
        <div className="arena-card p-10 text-center space-y-3">
          <Trophy className="mx-auto h-9 w-9 text-amber-500/70" />
          <h2 className="font-display-caps text-lg font-bold">No Tournaments in This Server Yet</h2>
          <p className="text-xs sm:text-sm text-[var(--arena-muted)] max-w-md mx-auto">
            Start a new tournament in Draft mode, add Squad Power brackets and maps, then publish it to Discord & Web.
          </p>
          <Link href={`/tournaments/new?guildId=${encodeURIComponent(guildId)}`} className="arena-btn-primary text-xs">
            <PlusCircle className="h-4 w-4" /> Create First Draft
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => {
            const reviews = (t.counts?.pendingPower || 0) + (t.counts?.pendingReviews || 0) + (t.counts?.disputed || 0);
            return (
              <Link
                key={t._id}
                href={`/tournaments/${t._id}`}
                className="arena-card group overflow-hidden flex flex-col justify-between hover:border-amber-500/70 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--arena-border)] bg-[var(--arena-elevated)]/70 px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-cyan-500 truncate">
                      <Gamepad2 className="h-3.5 w-3.5 shrink-0" /> {t.gameName || "Game"}
                    </span>
                    <TournamentStatusBadge status={t.status} />
                  </div>
                  <div className="p-4 sm:p-5 space-y-3">
                    <div>
                      <h3 className="font-display-caps text-lg font-bold group-hover:text-amber-500 line-clamp-1">{t.name}</h3>
                      <p className="mt-1 text-xs text-[var(--arena-muted)] line-clamp-2 min-h-[2rem]">
                        {t.description || "Official competitive event."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <FormatBadge format={t.format} />
                      <span className="rounded-md border border-[var(--arena-border)] bg-[var(--arena-elevated)] px-2 py-0.5 text-[11px] font-semibold uppercase">
                        {t.mode === "team" ? `Teams ${t.teamSizeMin}-${t.teamSizeMax}` : "Solo"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                      <div className="rounded-lg bg-[var(--arena-elevated)] py-1.5">
                        <div className="font-mono text-sm font-bold">{t.counts?.registrations || 0}</div>
                        <div className="text-[10px] uppercase text-[var(--arena-muted)] flex items-center justify-center gap-1"><Users className="h-3 w-3" /> Players</div>
                      </div>
                      <div className="rounded-lg bg-[var(--arena-elevated)] py-1.5">
                        <div className="font-mono text-sm font-bold">{t.counts?.matches || 0}</div>
                        <div className="text-[10px] uppercase text-[var(--arena-muted)] flex items-center justify-center gap-1"><Swords className="h-3 w-3" /> Matches</div>
                      </div>
                      <div className="rounded-lg bg-[var(--arena-elevated)] py-1.5">
                        <div className="font-mono text-sm font-bold">{t.bracketsEnabled ? t.brackets.length : "Open"}</div>
                        <div className="text-[10px] uppercase text-[var(--arena-muted)] flex items-center justify-center gap-1"><Layers className="h-3 w-3" /> Brackets</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-t border-[var(--arena-border)] px-4 py-2.5 flex items-center justify-between text-xs">
                  {reviews > 0 ? (
                    <span className="flex items-center gap-1 font-semibold text-amber-500">
                      <AlertTriangle className="h-3.5 w-3.5" /> {reviews} pending
                    </span>
                  ) : (
                    <span className="text-[var(--arena-muted)]">{t.scoring.replace(/_/g, " ")}</span>
                  )}
                  <span className="flex items-center gap-1 font-bold text-amber-500">
                    Open <ArrowRight className="h-3.5 w-3.5" />
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

export default function ServerWorkspacePage() {
  return (
    <AuthGuard>
      <ServerWorkspaceContent />
    </AuthGuard>
  );
}

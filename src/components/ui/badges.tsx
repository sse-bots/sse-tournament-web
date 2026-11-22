import React from "react";
import { TournamentStatus, MatchStatus, TournamentFormat } from "@/lib/types";

const TOURNAMENT_STATUS_STYLE: Record<TournamentStatus, { label: string; cls: string; dot?: string }> = {
  draft: { label: "DRAFT", cls: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30" },
  registration: { label: "REGISTRATION OPEN", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35", dot: "bg-emerald-500" },
  registration_closed: { label: "REG CLOSED", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35" },
  matchmaking: { label: "MATCHMAKING", cls: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/35", dot: "bg-cyan-500" },
  in_progress: { label: "LIVE ARENA", cls: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40", dot: "bg-red-500 animate-pulse" },
  paused: { label: "PAUSED", cls: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/35" },
  completed: { label: "COMPLETED", cls: "bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/40" },
  cancelled: { label: "CANCELLED", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35" },
  archived: { label: "ARCHIVED", cls: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30" },
};

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  const cfg = TOURNAMENT_STATUS_STYLE[status] || TOURNAMENT_STATUS_STYLE.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase ${cfg.cls}`}>
      {cfg.dot && <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />}
      {cfg.label}
    </span>
  );
}

const MATCH_STATUS_STYLE: Record<MatchStatus, string> = {
  scheduled: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30",
  ready: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/35",
  in_progress: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40",
  pending_proof: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35",
  pending_review: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
  rejected: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40",
  disputed: "bg-rose-600/20 text-rose-700 dark:text-rose-300 border-rose-500/50",
  postponed: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/35",
  forfeited: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/35",
  cancelled: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
};

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${MATCH_STATUS_STYLE[status] || MATCH_STATUS_STYLE.scheduled}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  single_elimination: "Single Elim",
  double_elimination: "Double Elim",
  round_robin: "Round Robin",
  swiss: "Swiss System",
  series: "Best-of Series",
  custom: "Custom Series",
};

export function FormatBadge({ format }: { format: TournamentFormat }) {
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--arena-border)] bg-[var(--arena-elevated)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--arena-text)]">
      {FORMAT_LABELS[format] || format}
    </span>
  );
}

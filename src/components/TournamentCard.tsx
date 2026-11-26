"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { ChevronRight, Crown, Gamepad2, Layers, Swords, Users } from "lucide-react";
import {
  FORMAT_LABELS,
  SCORING_LABELS,
  STATUS_META,
  type TournamentSummary,
} from "@/lib/tournament-types";

export function TournamentCard({
  tournament,
  href,
  manageHref,
}: {
  tournament: TournamentSummary;
  href?: string;
  manageHref?: string;
}) {
  const statusInfo = STATUS_META[tournament.status] || STATUS_META.draft;
  const targetHref =
    href || `/servers/${tournament.guildId}/tournaments/${tournament.id}`;

  return (
    <div
      data-status={tournament.status}
      className="sse-tcard group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 transition hover:border-indigo-500/60 hover:shadow-xl"
    >
      <div className="border-b border-slate-800/80 bg-slate-950/50 px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-900 px-2.5 py-0.5 text-[11px] font-bold text-slate-200">
            <Gamepad2 className="h-3 w-3 text-indigo-400" />
            {tournament.gameName}
          </span>
          <span
            className="sse-status-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
            style={
              {
                backgroundColor: statusInfo.bg,
                "--pill-dark": statusInfo.color,
                "--pill-light": statusInfo.lightColor,
              } as CSSProperties
            }
          >
            {statusInfo.pulse && (
              <span className="sse-status-dot h-1.5 w-1.5 animate-pulse rounded-full" />
            )}
            {statusInfo.label}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <h3 className="line-clamp-1 text-base font-extrabold text-white transition group-hover:text-indigo-300">
            {tournament.name}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-400">
            {tournament.description ||
              `Competitive ${tournament.gameName} ${FORMAT_LABELS[tournament.format]} tournament powered by SSE Tournament Bot.`}
          </p>

          <div className="mt-3.5 flex flex-wrap gap-1.5">
            <span className="rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-1 text-[10px] font-bold text-slate-300">
              {FORMAT_LABELS[tournament.format]}
            </span>
            <span className="rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-1 text-[10px] font-bold capitalize text-slate-300">
              {tournament.mode === "team"
                ? `Teams (${tournament.teamSizeMin}–${tournament.teamSizeMax})`
                : "Solo / 1v1"}
            </span>
            <span className="rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-1 text-[10px] font-bold text-slate-300">
              {SCORING_LABELS[tournament.scoring]}
            </span>
            {tournament.bracketsEnabled && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-300">
                <Layers className="h-3 w-3" />
                {tournament.brackets.length} SP Brackets
              </span>
            )}
          </div>

          {tournament.prizeDescriptions.first && (
            <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-300">
              <Crown className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                1st Prize: {tournament.prizeDescriptions.first}
              </span>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-3 border-t border-slate-800/80 pt-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-indigo-400" />
              <strong className="text-white">
                {tournament.counts.registrations}
              </strong>{" "}
              {tournament.mode === "team"
                ? `(${tournament.counts.teams} teams)`
                : "players"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Swords className="h-3.5 w-3.5 text-emerald-400" />
              <strong className="text-white">{tournament.counts.matches}</strong>{" "}
              matches
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={targetHref}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-white transition hover:border-indigo-500 hover:bg-slate-700"
            >
              Open Tournament
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            {manageHref && (
              <Link
                href={manageHref}
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-indigo-500"
              >
                Manage
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

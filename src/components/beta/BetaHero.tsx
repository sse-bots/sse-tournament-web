"use client";

import Link from "next/link";
import { Swords, Users } from "lucide-react";
import { setUiMode } from "@/lib/ui-mode";
import { STATUS_META, type TournamentSummary } from "@/lib/tournament-types";

export interface BetaOverviewStats {
  totalTournaments: number;
  liveTournaments: number;
  openTournaments: number;
  totalRegistrations: number;
  totalTeams: number;
  totalMatches: number;
  activeGames: number;
}

/** Lifecycle stages shown as progress segments on the spotlight board. */
const STAGES: { key: TournamentSummary["status"][]; label: string }[] = [
  { key: ["registration"], label: "Sign-up" },
  { key: ["registration_closed"], label: "Closed" },
  { key: ["matchmaking"], label: "Matchmaking" },
  { key: ["in_progress", "paused"], label: "Playing" },
  { key: ["completed", "archived"], label: "Finished" },
];

function stageIndex(status: TournamentSummary["status"]): number {
  const i = STAGES.findIndex((s) => s.key.includes(status));
  return i; // -1 for draft / cancelled
}

function pickSpotlight(list: TournamentSummary[]): TournamentSummary | null {
  return (
    list.find((t) => t.status === "in_progress") ||
    list.find((t) => t.status === "registration") ||
    list[0] ||
    null
  );
}

export function BetaHero({
  stats,
  featured,
  signedIn,
}: {
  stats: BetaOverviewStats | undefined;
  featured: TournamentSummary[];
  signedIn: boolean;
}) {
  const spotlight = pickSpotlight(featured);
  const live = stats?.liveTournaments ?? 0;

  const fmt = (n: number) => n.toLocaleString("en-US");

  const statTiles = [
    {
      label: "Tournaments",
      value: stats ? fmt(stats.totalTournaments) : "—",
      note: stats && stats.liveTournaments > 0 ? `${stats.liveTournaments} live` : "",
    },
    {
      label: "Open for sign-up",
      value: stats ? fmt(stats.openTournaments) : "—",
      note: "",
    },
    {
      label: "Players registered",
      value: stats ? fmt(stats.totalRegistrations) : "—",
      note: stats && stats.totalTeams > 0 ? `${stats.totalTeams} teams` : "",
    },
    {
      label: "Matches tracked",
      value: stats ? fmt(stats.totalMatches) : "—",
      note: "",
    },
  ];

  const meta = spotlight ? STATUS_META[spotlight.status] || STATUS_META.draft : null;
  const current = spotlight ? stageIndex(spotlight.status) : -1;
  const isTeam = spotlight?.mode === "team";

  return (
    <section className="bx-home">
      <div className="bx-hero">
        <div className="bx-hero-copy">
          <span className="bx-live">
            <i className="bx-dot" />
            {live > 0
              ? `${live} tournament${live === 1 ? "" : "s"} live now`
              : "Multi-server esports manager"}
          </span>
          <h1 className="bx-h1">
            Run pro-grade Discord tournaments without the chaos
          </h1>
          <p className="bx-lead">
            Built for <b>Mech Arena, Free Fire and Minecraft</b> communities.
            Pick your Discord server, launch a tournament from a template,
            verify proofs and declare winners.
          </p>
          <div className="bx-cta">
            <Link
              href={signedIn ? "/servers" : "/api/auth/login?next=/servers"}
              className="bx-btn bx-btn-primary"
            >
              {signedIn ? "Select your server" : "Sign in and select server"}
            </Link>
            <Link href="/docs" className="bx-btn bx-btn-ghost">
              Bot documentation
            </Link>
          </div>
        </div>

        <div className="bx-board" aria-label="Featured tournament">
          {spotlight && meta ? (
            <>
              <div className="bx-board-head">
                <span className="bx-board-title">
                  {spotlight.name}
                  <small>{spotlight.gameName}</small>
                </span>
                <span className="bx-status" style={{ color: meta.color }}>
                  {meta.pulse && <i className="bx-dot" />}
                  {meta.label}
                </span>
              </div>

              <div className="bx-side bx-side-lead">
                <span className="bx-tag bx-tag-a">
                  <Users className="bx-ic" />
                </span>
                <span className="bx-side-name">
                  {isTeam ? "Teams" : "Players"}
                  <small>
                    {isTeam
                      ? `${spotlight.teamSizeMin}–${spotlight.teamSizeMax} per team`
                      : "Solo entries"}
                  </small>
                </span>
                <span className="bx-score">
                  {isTeam
                    ? spotlight.counts.teams
                    : spotlight.counts.registrations}
                </span>
              </div>
              <div className="bx-side">
                <span className="bx-tag bx-tag-b">
                  <Swords className="bx-ic" />
                </span>
                <span className="bx-side-name">
                  Matches
                  <small>Synced with Discord</small>
                </span>
                <span className="bx-score">{spotlight.counts.matches}</span>
              </div>

              <div className="bx-pips">
                {STAGES.map((s, i) => (
                  <i
                    key={s.label}
                    title={s.label}
                    className={`bx-pip ${
                      i < current ? "is-done" : i === current ? "is-now" : ""
                    }`}
                  />
                ))}
                <Link
                  href={`/servers/${spotlight.guildId}/tournaments/${spotlight.id}`}
                  className="bx-pips-link"
                >
                  Open tournament
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="bx-board-head">
                <span className="bx-board-title">
                  Your first tournament
                  <small>Nothing live yet</small>
                </span>
              </div>
              <div className="bx-empty">
                Pick a Discord server and start from a ready-made template.
                Live tournaments show up here as soon as they are created.
              </div>
              <div className="bx-pips">
                <Link href="/servers" className="bx-pips-link">
                  Select a server
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bx-strip">
        {statTiles.map((t) => (
          <div key={t.label} className="bx-strip-cell">
            <b>{t.value}</b>
            <span>{t.label}</span>
            {t.note && <em>{t.note}</em>}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setUiMode("classic")}
        className="bx-back"
      >
        Switch back to the original design
      </button>
    </section>
  );
}

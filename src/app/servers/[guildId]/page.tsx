"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Gamepad2,
  LifeBuoy,
  Plus,
  RefreshCw,
  ScrollText,
  Settings,
  Swords,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { RoleBadge } from "@/components/RoleBadge";
import { ServerGuard } from "@/components/ServerGuard";
import { TournamentCard } from "@/components/TournamentCard";
import { useWorkspace } from "@/components/WorkspaceContext";

export default function ServerOverviewPage() {
  const params = useParams<{ guildId: string }>();
  const guildId = decodeURIComponent(params.guildId || "");
  const { serverData, refreshServer } = useWorkspace();

  const settings = serverData?.settings;
  const stats = serverData?.stats;
  const access = serverData?.access;
  const recent = serverData?.recentTournaments || [];

  return (
    <ServerGuard guildId={guildId}>
      {settings && stats && access && (
        <div className="space-y-6">
          {/* Server Workspace Hero */}
          <section className="sse-arena-hero rounded-3xl border border-slate-800 p-6 shadow-2xl sm:p-7">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-4">
                {settings.guildIcon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.guildIcon}
                    alt={settings.guildName}
                    className="h-16 w-16 shrink-0 rounded-2xl border-2 border-slate-700 object-cover shadow-xl"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-black text-white shadow-xl">
                    {settings.guildName.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <RoleBadge role={access.role} />
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        settings.botOnline
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          settings.botOnline
                            ? "animate-pulse bg-emerald-500"
                            : "bg-slate-500"
                        }`}
                      />
                      {settings.botOnline ? "Bot Online & Synced" : "Bot Offline / Pending Sync"}
                    </span>
                  </div>
                  <h1 className="mt-2 truncate text-2xl font-black tracking-tight text-white sm:text-3xl">
                    {settings.guildName}
                  </h1>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Server ID <code className="font-mono text-slate-300">{guildId}</code>
                    {stats.memberCount > 0 ? ` · ${stats.memberCount.toLocaleString()} members` : ""}
                    {settings.botLastSyncAt
                      ? ` · Synced ${new Date(settings.botLastSyncAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={refreshServer}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs font-bold text-slate-200 transition hover:border-indigo-500"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sync
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

            {/* KPI Tiles */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: "Tournaments",
                  value: stats.totalTournaments,
                  sub: `${stats.liveTournaments} live · ${stats.openTournaments} open`,
                  icon: Trophy,
                  tone: "text-amber-400",
                },
                {
                  label: "Server Games",
                  value: stats.totalGames,
                  sub: "Active catalog",
                  icon: Gamepad2,
                  tone: "text-indigo-400",
                },
                {
                  label: "Participants",
                  value: stats.totalRegistrations,
                  sub: "Across active events",
                  icon: Users,
                  tone: "text-sky-400",
                },
                {
                  label: access.canViewStaffTools ? "Staff Queue" : "Open Arenas",
                  value: access.canViewStaffTools
                    ? stats.pendingPower + stats.pendingMatches + stats.openTickets
                    : stats.openTournaments,
                  sub: access.canViewStaffTools
                    ? `${stats.pendingPower} SP · ${stats.pendingMatches} matches · ${stats.openTickets} tickets`
                    : "Registration open",
                  icon: access.canViewStaffTools ? Zap : Swords,
                  tone: "text-emerald-400",
                },
              ].map((tile) => {
                const Icon = tile.icon;
                return (
                  <div
                    key={tile.label}
                    className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4"
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <span>{tile.label}</span>
                      <Icon className={`h-4 w-4 ${tile.tone}`} />
                    </div>
                    <div className="mt-1.5 text-2xl font-black text-white">
                      {tile.value}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-400">
                      {tile.sub}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Staff Queue Alerts */}
          {access.canViewStaffTools &&
            (stats.pendingPower > 0 ||
              stats.pendingMatches > 0 ||
              stats.openTickets > 0) && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {stats.pendingPower > 0 && (
                  <Link
                    href={`/servers/${guildId}/tournaments`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200 transition hover:border-amber-500/70"
                  >
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
                      <div>
                        <strong className="block text-white">
                          {stats.pendingPower} Squad Power Proof(s)
                        </strong>
                        <span>Waiting for approval</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-amber-400" />
                  </Link>
                )}
                {stats.pendingMatches > 0 && (
                  <Link
                    href={`/servers/${guildId}/tournaments`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-200 transition hover:border-rose-500/70"
                  >
                    <div className="flex items-center gap-2.5">
                      <Swords className="h-5 w-5 shrink-0 text-rose-400" />
                      <div>
                        <strong className="block text-white">
                          {stats.pendingMatches} Match Proof / Dispute(s)
                        </strong>
                        <span>Needs moderator review</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-rose-400" />
                  </Link>
                )}
                {stats.openTickets > 0 && (
                  <Link
                    href={`/servers/${guildId}/tickets`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-500/40 bg-indigo-500/10 p-4 text-xs text-indigo-300 transition hover:border-indigo-500/70"
                  >
                    <div className="flex items-center gap-2.5">
                      <LifeBuoy className="h-5 w-5 shrink-0 text-indigo-400" />
                      <div>
                        <strong className="block text-white">
                          {stats.openTickets} Open Support Ticket(s)
                        </strong>
                        <span>Respond or assign staff</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-indigo-400" />
                  </Link>
                )}
              </div>
            )}

          {/* Quick Workspace Navigation Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href={`/servers/${guildId}/games`}
              className="group flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-indigo-500/60"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
                  <Gamepad2 className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-white group-hover:text-indigo-300">
                    Games
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {stats.totalGames} configured
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-indigo-400" />
            </Link>

            <Link
              href={`/servers/${guildId}/tournaments`}
              className="group flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-indigo-500/60"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                  <Trophy className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-white group-hover:text-indigo-300">
                    Tournaments
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {stats.totalTournaments} arenas
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-indigo-400" />
            </Link>

            {access.canViewStaffTools && (
              <Link
                href={`/servers/${guildId}/tickets`}
                className="group flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-indigo-500/60"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                    <LifeBuoy className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-extrabold text-white group-hover:text-indigo-300">
                      Support Desk
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {stats.openTickets} open tickets
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-indigo-400" />
              </Link>
            )}

            {access.canManageServerSettings ? (
              <Link
                href={`/servers/${guildId}/settings`}
                className="group flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-indigo-500/60"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                    <Settings className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-extrabold text-white group-hover:text-indigo-300">
                      Server Settings
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Roles &amp; channels
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-indigo-400" />
              </Link>
            ) : access.canViewStaffTools ? (
              <Link
                href={`/servers/${guildId}/audit`}
                className="group flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-indigo-500/60"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                    <ScrollText className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-extrabold text-white group-hover:text-indigo-300">
                      Audit Logs
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Staff history
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-indigo-400" />
              </Link>
            ) : null}
          </div>

          {/* Owner Setup Helper if Bot Not Online or No Games Yet */}
          {access.isServerOwner && (!settings.botOnline || stats.totalGames === 0) && (
            <section className="rounded-3xl border border-amber-500/35 bg-amber-500/10 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold text-amber-300">
                    Quick Server Setup Checklist
                  </h2>
                  <p className="mt-0.5 text-xs text-amber-200">
                    Complete these steps so Discord roles, match rooms, and WebSync
                    stay connected.
                  </p>
                </div>
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:border-indigo-500"
                >
                  <BookOpen className="h-3.5 w-3.5 text-amber-400" />
                  Full Bot Guide
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5">
                  <div className="text-xs font-bold text-white">1. Activate Bot</div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Run <code className="text-indigo-300">/activate</code> and{" "}
                    <code className="text-indigo-300">/setup</code> in Discord.
                  </p>
                  <div className="mt-2">
                    <CopyButton value="/setup" label="Copy /setup" />
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5">
                  <div className="text-xs font-bold text-white">2. Add Server Games</div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Add Mech Arena, Free Fire, or Minecraft in one click.
                  </p>
                  <Link
                    href={`/servers/${guildId}/games`}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:underline"
                  >
                    Open Games Catalog <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5">
                  <div className="text-xs font-bold text-white">3. Launch from Template</div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Pick a preset or blank builder and assign Moderator roles.
                  </p>
                  <Link
                    href={`/servers/${guildId}/tournaments/new`}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:underline"
                  >
                    Create Tournament <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* Recent Tournaments in this Server */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-extrabold text-white">
                  Recent Tournaments in {settings.guildName}
                </h2>
                <p className="text-xs text-slate-400">
                  Click any tournament to open its dedicated workspace (Matches,
                  Brackets, Standings, Teams &amp; Settings).
                </p>
              </div>
              <Link
                href={`/servers/${guildId}/tournaments`}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:underline"
              >
                View all ({stats.totalTournaments}) <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-10 text-center">
                <Trophy className="mx-auto mb-3 h-10 w-10 text-indigo-400" />
                <h3 className="text-base font-bold text-white">
                  No Tournaments Yet
                </h3>
                <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
                  {access.canCreateTournament
                    ? "Start your server's first competitive event using our ready-made game templates or a blank builder."
                    : "The Server Owner hasn't created any tournaments yet. Check back soon!"}
                </p>
                {access.canCreateTournament && (
                  <Link
                    href={`/servers/${guildId}/tournaments/new`}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
                  >
                    <Plus className="h-4 w-4" />
                    Create First Tournament
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recent.map((t) => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    href={`/servers/${guildId}/tournaments/${t.id}`}
                    manageHref={
                      access.canViewStaffTools
                        ? `/servers/${guildId}/tournaments/${t.id}/settings`
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </ServerGuard>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ExternalLink,
  Gamepad2,
  LifeBuoy,
  LogIn,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { RoleBadge } from "@/components/RoleBadge";
import { SITE_SETTINGS } from "@/lib/site-settings";
import type {
  ServerAccessRole,
  ServerWorkspaceSummary,
} from "@/lib/tournament-types";

type RoleFilter = "all" | ServerAccessRole | "bot_active";

export default function ServersPage() {
  const { user, loading: authLoading } = useAuth();
  const [servers, setServers] = useState<ServerWorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const loadServers = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/servers", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          data?.error || "Could not fetch your Discord servers from SSE Accounts."
        );
        return;
      }
      setServers(data?.servers || []);
    } catch {
      setError("Network error while loading your servers.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      loadServers();
    }
  }, [authLoading, loadServers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return servers.filter((s) => {
      if (roleFilter === "bot_active" && !s.botConfigured) return false;
      if (
        roleFilter !== "all" &&
        roleFilter !== "bot_active" &&
        s.role !== roleFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
      );
    });
  }, [servers, search, roleFilter]);

  const ownerCount = servers.filter((s) => s.role === "owner").length;
  const modCount = servers.filter((s) => s.role === "moderator").length;
  const activeBotCount = servers.filter((s) => s.botConfigured).length;

  if (authLoading || loading) {
    return (
      <div className="space-y-5">
        <div className="h-32 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-56 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto mt-10 max-w-lg overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/75 shadow-2xl">
        <div className="sse-arena-hero border-b border-slate-800/80 px-6 py-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
            <Server className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-black text-white">
            Select Your Discord Server
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            Sign in with your centralized{" "}
            <strong className="text-white">SSE Account</strong> to browse every
            Discord server you belong to. Server Owners can create and configure
            tournaments, assigned Moderators unlock full admin tools, and
            members can follow live brackets and standings.
          </p>
        </div>
        <div className="space-y-3 p-6 text-center">
          <Link
            href="/api/auth/login?next=/servers"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500"
          >
            <LogIn className="h-4 w-4" />
            Sign In with SSE Accounts
          </Link>
          <Link
            href="/docs"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:border-indigo-500 hover:text-white"
          >
            <BookOpen className="h-4 w-4 text-amber-400" />
            Read Bot Setup Documentation
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Hero */}
      <section className="sse-arena-hero rounded-3xl border border-slate-800 p-6 shadow-xl sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/15 px-3 py-0.5 text-[11px] font-bold text-indigo-300">
              <Sparkles className="h-3 w-3" />
              Multi-Server Tournament Manager
            </div>
            <h1 className="mt-2.5 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Select a Discord Server
            </h1>
            <p className="mt-1 text-xs text-slate-300">
              Choose a server to switch your sidebar into its dedicated{" "}
              <strong className="text-white">Games &amp; Tournaments</strong>{" "}
              workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadServers}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs font-bold text-slate-200 transition hover:border-indigo-500"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Syncing..." : "Refresh Servers"}
            </button>
            <a
              href={SITE_SETTINGS.links.nexusUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-500"
            >
              Activate a Server
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Summary KPI Bar */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Your Servers", value: servers.length, icon: Server, tone: "text-indigo-400" },
            { label: "Bot Active", value: activeBotCount, icon: Zap, tone: "text-emerald-400" },
            { label: "Owner Access", value: ownerCount, icon: Trophy, tone: "text-amber-400" },
            { label: "Moderator Access", value: modCount, icon: Users, tone: "text-sky-400" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-800 bg-slate-950/75 px-4 py-3"
              >
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span>{stat.label}</span>
                  <Icon className={`h-3.5 w-3.5 ${stat.tone}`} />
                </div>
                <div className="mt-1 text-xl font-black text-white">
                  {stat.value}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs font-medium text-rose-300">
          {error}
        </div>
      )}

      {/* Search & Role Filters */}
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your Discord servers by name or ID..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: "all", label: `All (${servers.length})` },
              { id: "bot_active", label: `Bot Active (${activeBotCount})` },
              { id: "owner", label: `Owner (${ownerCount})` },
              { id: "moderator", label: `Moderator (${modCount})` },
              { id: "member", label: "Member" },
            ] as Array<{ id: RoleFilter; label: string }>
          ).map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setRoleFilter(pill.id)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                roleFilter === pill.id
                  ? "bg-indigo-600 text-white"
                  : "border border-slate-800 bg-slate-950 text-slate-300 hover:border-indigo-500/50 hover:text-white"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Server Cards Grid */}
      {servers.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-10 text-center">
          <Server className="mx-auto mb-3 h-10 w-10 text-amber-400" />
          <h2 className="text-base font-extrabold text-white">
            No Discord Servers Found
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-400">
            Link your Discord account inside{" "}
            <a
              href={`${SITE_SETTINGS.links.accountsUrl}/account/security`}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-indigo-400 underline"
            >
              SSE Accounts → Security &amp; Links
            </a>{" "}
            and sign back in so we can load your Discord servers automatically.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <a
              href={`${SITE_SETTINGS.links.accountsUrl}/account/security`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
            >
              Link Discord in SSE Accounts
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-10 text-center text-xs text-slate-400">
          No servers match your current filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 transition hover:border-indigo-500/60 hover:shadow-xl"
            >
              {/* Card Top Header */}
              <div className="border-b border-slate-800/80 bg-slate-950/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {s.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.icon}
                        alt={s.name}
                        className="h-12 w-12 shrink-0 rounded-2xl border border-slate-700 object-cover shadow-md"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-black text-white shadow-md">
                        {s.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-extrabold text-white transition group-hover:text-indigo-300">
                        {s.name}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <RoleBadge role={s.role} compact />
                      </div>
                    </div>
                  </div>

                  {/* Live Bot Heartbeat Pill */}
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      s.botOnline
                        ? "bg-emerald-500/15 text-emerald-300"
                        : s.botConfigured
                          ? "bg-sky-500/15 text-sky-300"
                          : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        s.botOnline
                          ? "animate-pulse bg-emerald-500"
                          : s.botConfigured
                            ? "bg-sky-500"
                            : "bg-slate-500"
                      }`}
                    />
                    {s.botOnline
                      ? "Bot Online"
                      : s.botConfigured
                        ? "Synced"
                        : "Setup Needed"}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="flex flex-1 flex-col justify-between p-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-400">
                      <Trophy className="h-3 w-3 text-amber-400" />
                      Arenas
                    </div>
                    <div className="mt-1 text-base font-black text-white">
                      {s.tournamentCount}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-400">
                      <Gamepad2 className="h-3 w-3 text-indigo-400" />
                      Games
                    </div>
                    <div className="mt-1 text-base font-black text-white">
                      {s.gameCount}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-400">
                      <Zap className="h-3 w-3 text-emerald-400" />
                      Live
                    </div>
                    <div className="mt-1 text-base font-black text-white">
                      {s.liveTournamentCount + s.openRegistrationCount}
                    </div>
                  </div>
                </div>

                {s.role !== "member" && s.openTicketCount > 0 && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300">
                    <LifeBuoy className="h-3.5 w-3.5 shrink-0" />
                    {s.openTicketCount} open support ticket
                    {s.openTicketCount === 1 ? "" : "s"}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <Link
                    href={s.role === "member" ? `/servers/${s.id}/tournaments` : `/servers/${s.id}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500"
                  >
                    {s.role === "member" ? "View Tournaments" : "Open Server Workspace"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  {s.role === "owner" && !s.botConfigured && (
                    <Link
                      href="/docs"
                      title="Bot Setup Guide"
                      className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-slate-300 transition hover:border-indigo-500 hover:text-white"
                    >
                      <BookOpen className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

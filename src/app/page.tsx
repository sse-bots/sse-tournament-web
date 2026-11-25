"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Gamepad2,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { TournamentCard } from "@/components/TournamentCard";
import { useAuth } from "@/components/AuthContext";
import { SITE_SETTINGS } from "@/lib/site-settings";
import { QUICKSTART_STEPS } from "@/lib/bot-docs-data";
import type { TournamentSummary } from "@/lib/tournament-types";

interface OverviewData {
  stats: {
    totalTournaments: number;
    liveTournaments: number;
    openTournaments: number;
    totalRegistrations: number;
    totalTeams: number;
    totalMatches: number;
    activeGames: number;
  };
  featured: TournamentSummary[];
}

export default function HomePage() {
  const { user } = useAuth();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/overview", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats;

  return (
    <div className="space-y-8">
      <section className="sse-arena-hero sse-grid-pattern relative overflow-hidden rounded-3xl border border-slate-800 p-6 shadow-2xl sm:p-10">
        <div className="relative z-10 max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/15 px-3.5 py-1 text-xs font-bold text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" />
            SSE Tournament Bot · Live Esports Control &amp; Docs
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
            Run Pro-Grade Discord Tournaments Without the Chaos.
          </h1>

          <p className="max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Built for competitive{" "}
            <strong className="text-white">Mech Arena, Free Fire, and Minecraft</strong>{" "}
            communities. Automate Squad-Power brackets, private match rooms, screenshot proof review, Best-of series, Swiss/Double-Elim rounds, and live web leaderboards—synced with{" "}
            <strong className="text-white">SSE Accounts</strong>.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link href="/tournaments" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-extrabold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 sm:text-sm">
              <Trophy className="h-4 w-4" /> Browse Tournaments <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={user ? "/dashboard" : "/api/auth/login?next=/dashboard"} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-5 py-3 text-xs font-bold text-white transition hover:border-indigo-500 sm:text-sm">
              <LayoutDashboard className="h-4 w-4 text-indigo-400" />
              {user ? "Open Manager Dashboard" : "Sign In with SSE Accounts"}
            </Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-xs font-bold text-slate-200 transition hover:border-indigo-500 hover:text-white sm:text-sm">
              <BookOpen className="h-4 w-4 text-amber-400" /> Bot Documentation
            </Link>
          </div>
        </div>

        <div className="relative z-10 mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Arenas", value: stats ? stats.totalTournaments : "—", sub: stats ? `${stats.liveTournaments} live now` : "Loading...", icon: Trophy, accent: "text-amber-400" },
            { label: "Open Registration", value: stats ? stats.openTournaments : "—", sub: "Ready to join", icon: Zap, accent: "text-emerald-400" },
            { label: "Registered Players", value: stats ? stats.totalRegistrations : "—", sub: stats ? `${stats.totalTeams} active teams` : "Loading...", icon: Users, accent: "text-sky-400" },
            { label: "Matches Played", value: stats ? stats.totalMatches : "—", sub: "Auto-tracked", icon: Swords, accent: "text-indigo-400" },
          ].map((tile) => {
            const Icon = tile.icon;
            return (
              <div key={tile.label} className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tile.label}</span>
                  <Icon className={`h-4 w-4 ${tile.accent}`} />
                </div>
                <div className="mt-1.5 text-2xl font-black text-white">{tile.value}</div>
                <div className="mt-0.5 text-[11px] text-slate-400">{tile.sub}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-extrabold text-white">Live &amp; Recent Tournaments</h2>
            <p className="text-xs text-slate-400">Real-time data synced directly from SSE Tournament Bot&apos;s MongoDB cluster.</p>
          </div>
          <Link href="/tournaments" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:underline">
            View all tournaments <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => <div key={n} className="h-60 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60" />)}
          </div>
        ) : data?.featured && data.featured.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.featured.map((t) => <TournamentCard key={t.id} tournament={t} />)}
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 text-center">
            <Trophy className="mx-auto mb-3 h-10 w-10 text-indigo-400" />
            <h3 className="text-base font-bold text-white">Ready for Your First Tournament</h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
              Create your first tournament from the <strong className="text-white">Manager Dashboard</strong> or run <code className="text-indigo-400">/tournament create</code> in Discord.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              <Link href="/dashboard" className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500">Create Tournament</Link>
              <Link href="/docs" className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:border-indigo-500">Read Bot Setup Guide</Link>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-extrabold text-white">Engineered for Multi-Game Communities</h2>
          <p className="text-xs text-slate-400">First-class rulesets for Squad Power, Squad Rosters, Swiss rounds, and proof verification.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {SITE_SETTINGS.featuredGames.map((g) => (
            <div key={g.name} className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400"><Gamepad2 className="h-5 w-5" /></span>
                  <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[10px] font-bold text-indigo-300">{g.badge}</span>
                </div>
                <h3 className="mt-3.5 text-base font-extrabold text-white">{g.name}</h3>
                <p className="mt-1 text-[11px] font-semibold text-amber-400">{g.format}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{g.description}</p>
              </div>
              <Link href="/docs" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:underline">
                View {g.name} playbook <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-white">6-Step Tournament Bot Workflow</h2>
            <p className="text-xs text-slate-400">From server activation to frozen final standings and automatic winner roles.</p>
          </div>
          <Link href="/docs" className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500">
            <BookOpen className="h-3.5 w-3.5" /> Full Command Docs (55+)
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {QUICKSTART_STEPS.map((s) => (
            <div key={s.step} className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-[11px] font-black text-white">{s.step}</span>
                <h3 className="text-xs font-extrabold text-white">{s.title}</h3>
              </div>
              <code className="mt-2.5 block truncate rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 font-mono text-[10px] text-indigo-300">{s.command}</code>
              <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-slate-400">{s.detail}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-slate-800/80 pt-4 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Conflict-of-interest Fair Play Guard</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> 100% Immutable Audit Logs</span>
          <span className="inline-flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-400" /> 24h Automated Match &amp; Deadline Reminders</span>
        </div>
      </section>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Trophy,
  ShieldCheck,
  Layers,
  Users,
  Swords,
  CheckCircle2,
  Bot,
  Globe,
  ArrowRight,
  Sparkles,
  Award,
  BellRing,
  LayoutDashboard,
  Lock,
} from "lucide-react";
import { useArena } from "@/components/theme-provider";
import { signInWithNexus } from "@/lib/auth-client";
import { useToast } from "@/components/ui/toast";

const FEATURE_BLOCKS = [
  {
    icon: Layers,
    color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/30",
    title: "Draft → Setup → Publish Studio",
    desc: "Configure Squad Power / XP brackets, allowed maps, scoring weights, and prizes safely in Draft mode before opening public registration.",
  },
  {
    icon: Users,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
    title: "Solo & Team HQ",
    desc: "Players submit in-game IDs and Squad Power proof, form squads with captains, send invites, and lock rosters automatically before matchmaking.",
  },
  {
    icon: Swords,
    color: "text-rose-500 bg-rose-500/10 border-rose-500/30",
    title: "6 Tournament Formats",
    desc: "Supports Single Elimination, Double Elimination, Round Robin, Swiss, Best-of Series (MAQC-style multi-day), and Custom schedules.",
  },
  {
    icon: CheckCircle2,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
    title: "Verified Proof & Conflict Guards",
    desc: "Managers who register to play are automatically blocked from approving their own tournament's results—fairness enforced on both Web and Bot.",
  },
  {
    icon: Award,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
    title: "Podium Leaderboards & CSV",
    desc: "Live standings by Wins, Points, Win %, Squad Power, or Combined weights—with frozen 1st/2nd/3rd placements and one-click CSV exports.",
  },
  {
    icon: BellRing,
    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
    title: "Private Discord Match Posts",
    desc: "Every match syncs with a private Discord channel where only assigned players, teammates, and referees can coordinate and upload proof.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Sign In with SSE Nexus",
    desc: "Use your single SSE Profile (linked with Discord) via OAuth 2.1 + PKCE. No separate account needed.",
  },
  {
    num: "02",
    title: "Verify Bot in Your Server",
    desc: "Your dashboard automatically checks which servers have SSE Tournament Bot installed and activated.",
  },
  {
    num: "03",
    title: "Run Tournaments in Real Time",
    desc: "Design brackets & review proofs visually on the Web while the Discord Bot handles channels, reminders, and winner roles.",
  },
];

export default function LandingPage() {
  const { actor, loadingActor } = useArena();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setBusy(true);
    try {
      await signInWithNexus("/dashboard");
    } catch (err) {
      push((err as Error).message, "error");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-14 space-y-14 sm:space-y-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--arena-border)] bg-[var(--arena-surface)] p-6 sm:p-12 shadow-arena">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="relative max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-amber-500">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            Official SSE Esports Tournament Platform
          </div>

          <h1 className="font-display-caps text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.06]">
            RUN DISCORD TOURNAMENTS LIKE A{" "}
            <span className="text-amber-500">PRO ARENA.</span>
          </h1>

          <p className="text-sm sm:text-base text-[var(--arena-muted)] leading-relaxed max-w-2xl">
            Built for Mech Arena, Free Fire, Minecraft, and multi-day competitive leagues. Pair the{" "}
            <strong className="text-[var(--arena-text)]">SSE Tournament Discord Bot</strong> with this visual Web
            Command Center for brackets, squad management, verified match posts, and championship podiums.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
            {!loadingActor && actor ? (
              <Link href="/dashboard" className="arena-btn-primary py-3 px-6 text-sm shadow-glowGold w-full sm:w-auto">
                <LayoutDashboard className="h-4 w-4" />
                Open Tournament Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={handleLogin}
                className="arena-btn-primary py-3 px-6 text-sm shadow-glowGold w-full sm:w-auto"
              >
                <ShieldCheck className="h-4 w-4" />
                {busy ? "Redirecting to SSE Nexus..." : "Login with SSE Nexus"}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}

            <a
              href="https://sse-nexus.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="arena-btn-secondary py-3 px-5 text-sm w-full sm:w-auto"
            >
              <Bot className="h-4 w-4 text-cyan-500" />
              Activate Bot via SSE Nexus
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs text-[var(--arena-muted)]">
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-emerald-500" /> Login required to create or join events
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-cyan-500" /> Automatic Discord Bot server check
            </span>
          </div>
        </div>
      </section>

      {/* Feature Blocks */}
      <section id="features" className="space-y-6">
        <div className="space-y-1.5">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-500">
            Arena Capabilities
          </div>
          <h2 className="font-display-caps text-2xl sm:text-3xl font-extrabold">
            Everything Needed From Draft to Finals
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_BLOCKS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="arena-card p-5 space-y-3 hover:border-amber-500/50 transition-colors">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${item.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display-caps text-lg font-bold">{item.title}</h3>
                <p className="text-xs sm:text-sm text-[var(--arena-muted)] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why Both Website + Discord Bot Matter */}
      <section id="bot-sync" className="arena-card p-6 sm:p-8 space-y-6">
        <div className="space-y-1.5">
          <div className="text-xs font-bold uppercase tracking-widest text-cyan-500">
            Two-Way Live Architecture
          </div>
          <h2 className="font-display-caps text-2xl sm:text-3xl font-extrabold">
            Web Command Center × Discord Bot
          </h2>
          <p className="text-sm text-[var(--arena-muted)] max-w-2xl">
            Neither replaces the other—both share the same live MongoDB database and sync queue so your
            community gets the fastest experience on Discord and the clearest management UI on the web.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
            <div className="flex items-center gap-2 font-display-caps text-base font-bold text-amber-500">
              <Globe className="h-5 w-5" /> What You Do on the Website
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-[var(--arena-muted)]">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> Visual Draft Studio for brackets, schedules, maps, and prizes</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> Interactive knockout bracket trees & round-by-round boards</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> Full-size screenshot inspection for Squad Power & match proof approvals</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> Podium leaderboards, dispute history timelines & CSV exports</li>
            </ul>
          </div>

          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-5 space-y-3">
            <div className="flex items-center gap-2 font-display-caps text-base font-bold text-cyan-500">
              <Bot className="h-5 w-5" /> What the Discord Bot Executes
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-[var(--arena-muted)]">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-500 shrink-0 mt-0.5" /> Creates private match channels with strict per-player Discord permissions</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-500 shrink-0 mt-0.5" /> Posts tournament announcements, schedules & winner podiums in Discord</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-500 shrink-0 mt-0.5" /> Sends automated 24h / 6h match reminders & overdue deadline alerts</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-500 shrink-0 mt-0.5" /> Awards 1st / 2nd / 3rd Discord roles & lets players run slash commands</li>
            </ul>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="space-y-6">
        <div className="space-y-1.5">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-500">
            Getting Started
          </div>
          <h2 className="font-display-caps text-2xl sm:text-3xl font-extrabold">
            Three Steps to Launch
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.num} className="arena-card p-5 space-y-2.5">
              <div className="font-mono text-2xl font-extrabold text-amber-500">{s.num}</div>
              <h3 className="font-display-caps text-lg font-bold">{s.title}</h3>
              <p className="text-xs sm:text-sm text-[var(--arena-muted)] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="arena-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-amber-500/35 bg-gradient-to-r from-amber-500/10 via-[var(--arena-surface)] to-cyan-500/10">
          <div>
            <div className="font-display-caps text-xl font-extrabold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" /> Ready to enter your Server Arena?
            </div>
            <p className="text-xs sm:text-sm text-[var(--arena-muted)] mt-0.5">
              Sign in with SSE Nexus to check your Discord servers and open your tournament dashboard.
            </p>
          </div>
          {actor ? (
            <Link href="/dashboard" className="arena-btn-primary whitespace-nowrap w-full sm:w-auto">
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <button type="button" disabled={busy} onClick={handleLogin} className="arena-btn-primary whitespace-nowrap w-full sm:w-auto">
              <ShieldCheck className="h-4 w-4" /> Login with SSE Nexus
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

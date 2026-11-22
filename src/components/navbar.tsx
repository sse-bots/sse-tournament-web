"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Trophy, Gamepad2, PlusCircle, LifeBuoy, ScrollText,
  Sun, Moon, LogOut, ShieldCheck, Server, Menu, X,
} from "lucide-react";
import { useArena } from "./theme-provider";
import { authClient, signInWithNexus } from "@/lib/auth-client";

const NAV_LINKS = [
  { href: "/", label: "Arena", icon: Trophy },
  { href: "/tournaments/new", label: "Create Draft", icon: PlusCircle },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/support", label: "Support Desk", icon: LifeBuoy },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
];

export function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme, actor, loadingActor, activeGuildId, setActiveGuildId, guilds, refreshActor } = useArena();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await authClient.signOut();
    await refreshActor();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--arena-border)] bg-[var(--arena-surface)]/90 backdrop-blur-md">
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-cyan-500 to-amber-500" />
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-glowGold transition-transform group-hover:scale-105">
            <Trophy className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div className="leading-none">
            <div className="font-display-caps text-lg font-extrabold tracking-wider">
              SSE <span className="text-amber-500">ARENA</span>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--arena-muted)]">
              Tournament Command
            </div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  active
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    : "text-[var(--arena-muted)] hover:text-[var(--arena-text)] hover:bg-[var(--arena-elevated)]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 rounded-lg border border-[var(--arena-border)] bg-[var(--arena-bg)] px-2.5 py-1.5">
            <Server className="h-3.5 w-3.5 text-cyan-500" />
            <select
              aria-label="Active Discord Server"
              value={activeGuildId}
              onChange={(e) => setActiveGuildId(e.target.value)}
              className="bg-transparent text-xs font-mono font-medium focus:outline-none max-w-[140px]"
            >
              <option value="">All Servers</option>
              {guilds.map((g) => (
                <option key={g.guildId} value={g.guildId} className="bg-slate-900 text-white">
                  Server {g.guildId.slice(-6)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--arena-border)] bg-[var(--arena-elevated)] hover:border-amber-500 transition-colors"
            title={theme === "dark" ? "Switch to Daylight Mode" : "Switch to Arena Dark Mode"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
          </button>

          {loadingActor ? (
            <div className="h-9 w-24 animate-pulse rounded-lg bg-[var(--arena-elevated)]" />
          ) : actor ? (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--arena-border)] bg-[var(--arena-elevated)] pl-2.5 pr-1.5 py-1">
              <div className="hidden sm:block text-right leading-tight">
                <div className="flex items-center justify-end gap-1 text-xs font-bold">
                  {actor.isBotAdmin && <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />}
                  <span>{actor.name}</span>
                </div>
                <div className="font-mono text-[10px] text-[var(--arena-muted)]">ID: {actor.discordId || "Linked"}</div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--arena-muted)] hover:bg-red-500/15 hover:text-red-500"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => signInWithNexus(pathname || "/")} className="arena-btn-primary text-xs px-3 py-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>SSE Nexus Login</span>
            </button>
          )}

          <button
            type="button"
            className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--arena-border)]"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-[var(--arena-border)] bg-[var(--arena-surface)] px-4 py-3 space-y-1">
          {NAV_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-[var(--arena-elevated)]"
              >
                <Icon className="h-4 w-4 text-amber-500" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}

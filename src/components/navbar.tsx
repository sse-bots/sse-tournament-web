"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Trophy,
  LayoutDashboard,
  Gamepad2,
  LifeBuoy,
  ScrollText,
  Sun,
  Moon,
  LogOut,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import { useArena } from "./theme-provider";
import { authClient, signInWithNexus } from "@/lib/auth-client";
import { useToast } from "./ui/toast";

const PUBLIC_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#bot-sync", label: "Bot Sync" },
  { href: "/#how-it-works", label: "How It Works" },
];

const AUTH_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/support", label: "Support", icon: LifeBuoy },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
];

export function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme, actor, loadingActor, refreshActor } = useArena();
  const { push } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleLogin() {
    setLoggingIn(true);
    try {
      await signInWithNexus("/dashboard");
    } catch (err) {
      push((err as Error).message, "error");
      setLoggingIn(false);
    }
  }

  async function handleSignOut() {
    await authClient.signOut();
    await refreshActor();
    setMobileOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--arena-border)] bg-[var(--arena-surface)]/92 backdrop-blur-md">
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-cyan-500 to-amber-500" />
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group min-w-0">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-glowGold transition-transform group-hover:scale-105">
            <Trophy className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
          </div>
          <div className="leading-none truncate">
            <div className="font-display-caps text-base sm:text-lg font-extrabold tracking-wider">
              SSE <span className="text-amber-500">ARENA</span>
            </div>
            <div className="hidden xs:block sm:block text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--arena-muted)]">
              Tournament Command
            </div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {actor
            ? AUTH_LINKS.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
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
              })
            : PUBLIC_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider text-[var(--arena-muted)] hover:text-[var(--arena-text)] hover:bg-[var(--arena-elevated)] transition-colors"
                >
                  {item.label}
                </Link>
              ))}
        </nav>

        {/* Right Actions — Never Wraps on Mobile */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--arena-border)] bg-[var(--arena-elevated)] hover:border-amber-500 transition-colors"
            title={theme === "dark" ? "Switch to Daylight Mode" : "Switch to Arena Dark Mode"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-slate-700" />
            )}
          </button>

          {loadingActor ? (
            <div className="h-9 w-20 animate-pulse rounded-lg bg-[var(--arena-elevated)]" />
          ) : actor ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--arena-border)] bg-[var(--arena-elevated)] pl-2.5 pr-1 py-1">
              <Link href="/dashboard" className="text-right leading-tight max-w-[110px] sm:max-w-[160px] truncate">
                <div className="flex items-center justify-end gap-1 text-xs font-bold truncate">
                  {actor.isBotAdmin && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                  <span className="truncate">{actor.name}</span>
                </div>
                <div className="hidden sm:block font-mono text-[10px] text-[var(--arena-muted)] truncate">
                  {actor.discordId || "SSE Profile"}
                </div>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--arena-muted)] hover:bg-red-500/15 hover:text-red-500"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={loggingIn}
              onClick={handleLogin}
              className="arena-btn-primary h-9 px-3 sm:px-4 text-xs whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="sm:hidden">{loggingIn ? "..." : "Login"}</span>
              <span className="hidden sm:inline">
                {loggingIn ? "Connecting..." : "SSE Nexus Login"}
              </span>
            </button>
          )}

          <button
            type="button"
            className="lg:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--arena-border)] bg-[var(--arena-elevated)]"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[var(--arena-border)] bg-[var(--arena-surface)] px-4 py-3 space-y-1.5">
          {actor ? (
            <>
              {AUTH_LINKS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[var(--arena-elevated)]"
                  >
                    <Icon className="h-4 w-4 text-amber-500" />
                    {item.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </>
          ) : (
            <>
              {PUBLIC_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[var(--arena-elevated)]"
                >
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                disabled={loggingIn}
                onClick={() => {
                  setMobileOpen(false);
                  handleLogin();
                }}
                className="arena-btn-primary w-full mt-2"
              >
                <ShieldCheck className="h-4 w-4" />
                Login with SSE Nexus
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
}

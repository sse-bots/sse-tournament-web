"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ExternalLink,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { ThemeCustomizer } from "@/components/ThemeCustomizer";
import { SITE_SETTINGS } from "@/lib/site-settings";
import {
  DEFAULT_THEME_STATE,
  PRIMARY_COLORS,
  THEME_PRESETS,
  ThemeState,
  applyThemeToDocument,
  loadSavedTheme,
  saveThemeState,
} from "@/lib/theme-config";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading, signOut } = useAuth();
  const [dockOpen, setDockOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState("");
  const [theme, setTheme] = useState<ThemeState>({
    ...DEFAULT_THEME_STATE,
    ...SITE_SETTINGS.defaultTheme,
  });

  useEffect(() => {
    const initial = loadSavedTheme();
    setTheme(initial);
    applyThemeToDocument(initial);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function handleSystemChange() {
      const latest = loadSavedTheme();
      if (latest.mode === "system") {
        applyThemeToDocument(latest);
      }
    }
    media.addEventListener("change", handleSystemChange);
    return () => media.removeEventListener("change", handleSystemChange);
  }, []);

  function updateTheme(next: ThemeState) {
    setTheme(next);
    saveThemeState(next);
    applyThemeToDocument(next);
  }

  useEffect(() => {
    setDockOpen(false);
    setQuickFilter("");
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setDockOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setDockOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const primaryLinks = [
    { href: "/", label: "Arena Home", icon: Home, exact: true },
    { href: "/tournaments", label: "Tournaments", icon: Trophy, exact: false },
    { href: "/dashboard", label: "Manager Dashboard", icon: LayoutDashboard, exact: false },
    { href: "/docs", label: "Bot Docs & Commands", icon: BookOpen, exact: false },
  ];

  const q = quickFilter.trim().toLowerCase();
  const filteredPrimary = q
    ? primaryLinks.filter((l) => l.label.toLowerCase().includes(q))
    : primaryLinks;

  const activePrimaryColor =
    PRIMARY_COLORS.find((c) => c.id === theme.primary) || PRIMARY_COLORS[7];
  const activePresetLabel =
    THEME_PRESETS.find((p) => p.id === theme.preset)?.label || "Arena";

  function renderNavLink(
    href: string,
    label: string,
    Icon: typeof Home,
    exact = false,
    idx = 0
  ) {
    const active = exact
      ? pathname === href
      : pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
    return (
      <Link
        key={href}
        href={href}
        style={{ animationDelay: `${Math.min(idx * 25, 220)}ms` }}
        className={`animate-menu-item flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
          active
            ? "bg-indigo-600/20 text-indigo-300"
            : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-[#07090e] text-slate-100 lg:flex">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-slate-800/80 lg:bg-[#0a0d14]">
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-extrabold text-white shadow-lg shadow-indigo-500/25">
              <Swords className="h-4 w-4" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-extrabold text-white">
                {SITE_SETTINGS.siteName}
              </div>
              <div className="truncate text-[11px] text-slate-400">
                {SITE_SETTINGS.tagline}
              </div>
            </div>
          </Link>
          <ThemeCustomizer theme={theme} onChange={updateTheme} align="left" />
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              placeholder="Quick jump (Ctrl+K)..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950/90 py-2 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Navigation
            </div>
            <nav className="space-y-1">
              {filteredPrimary.map((l, i) =>
                renderNavLink(l.href, l.label, l.icon, l.exact, i)
              )}
            </nav>
          </div>

          <div>
            <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              SSE Ecosystem
            </div>
            <div className="space-y-1">
              <a
                href={SITE_SETTINGS.links.accountsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800/70 hover:text-white"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                  SSE Accounts
                </span>
                <ExternalLink className="h-3 w-3 text-slate-500" />
              </a>
              <a
                href={SITE_SETTINGS.links.nexusUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800/70 hover:text-white"
              >
                <span className="flex items-center gap-2">
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  SSE Nexus Keys
                </span>
                <ExternalLink className="h-3 w-3 text-slate-500" />
              </a>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-800/80 p-3">
          {authLoading ? (
            <div className="h-11 animate-pulse rounded-xl bg-slate-800/70" />
          ) : user ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-2">
              <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt={user.name} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                    {user.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-white">{user.name}</div>
                  <div className="truncate text-[10px] text-slate-400">
                    {user.username ? `@${user.username}` : user.sseRole}
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={signOut}
                title="Logout"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-300"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/api/auth/login?next=/dashboard"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-indigo-500"
            >
              <LogIn className="h-4 w-4" />
              Sign In with SSE
            </Link>
          )}
        </div>
      </aside>

      <header className="sse-mobile-header flex items-center justify-between gap-2 border-b border-slate-800/80 bg-[#0a0d14]/90 backdrop-blur-md lg:hidden">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-extrabold text-white shadow-md shadow-indigo-500/25">
            <Swords className="h-4 w-4" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-extrabold tracking-tight text-white">
              {SITE_SETTINGS.siteName}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: activePrimaryColor.c500 }} />
              <span className="truncate">{user ? user.name : activePresetLabel}</span>
            </div>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeCustomizer theme={theme} onChange={updateTheme} align="right" />
          <button
            type="button"
            onClick={() => updateTheme({ ...theme, mode: theme.mode === "light" ? "dark" : "light" })}
            aria-label="Toggle Dark or Light Mode"
            className="rounded-xl border border-slate-800 bg-slate-900/90 p-2 text-slate-200 transition hover:border-indigo-500 active:scale-95"
          >
            {theme.mode === "light" ? (
              <Moon className="h-4 w-4 text-indigo-400" />
            ) : (
              <Sun className="h-4 w-4 text-amber-400" />
            )}
          </button>
        </div>
      </header>

      <div className="sse-main-shell flex min-w-0 flex-1 flex-col lg:pl-64">
        <main className="sse-main-content mx-auto w-full max-w-6xl flex-1 pt-5 sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </main>
      </div>

      {dockOpen && (
        <div className="animate-backdrop-in fixed inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-sm lg:hidden">
          <div className="flex-1" onClick={() => setDockOpen(false)} aria-hidden="true" />
          <div className="animate-sheet-up sse-mobile-sheet overflow-y-auto rounded-t-3xl border-t border-slate-800 bg-[#0b0e16] pt-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-700" />
            <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                  <Swords className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-white">{SITE_SETTINGS.siteName}</div>
                  <div className="text-[10px] text-slate-400">{activePresetLabel} · {activePrimaryColor.label}</div>
                </div>
              </div>
              <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900 p-0.5 text-[11px]">
                <button type="button" onClick={() => updateTheme({ ...theme, mode: "light" })} className={`rounded-lg p-1.5 ${theme.mode === "light" ? "bg-indigo-600 text-white" : "text-slate-400"}`}><Sun className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => updateTheme({ ...theme, mode: "dark" })} className={`rounded-lg p-1.5 ${theme.mode === "dark" ? "bg-indigo-600 text-white" : "text-slate-400"}`}><Moon className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => updateTheme({ ...theme, mode: "system" })} className={`rounded-lg p-1.5 ${theme.mode === "system" ? "bg-indigo-600 text-white" : "text-slate-400"}`}><Monitor className="h-3.5 w-3.5" /></button>
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-white">{user ? user.name : "Sign in with SSE Accounts"}</div>
                <div className="truncate text-[11px] text-slate-400">{user ? (user.username ? `@${user.username}` : user.sseRole) : "Manage your Discord server tournaments"}</div>
              </div>
              {user ? (
                <button type="button" onClick={signOut} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300">
                  <LogOut className="h-3.5 w-3.5" /> Logout
                </button>
              ) : (
                <Link href="/api/auth/login?next=/dashboard" className="shrink-0 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white">Sign In</Link>
              )}
            </div>

            <div className="space-y-1">
              {filteredPrimary.map((l, i) => renderNavLink(l.href, l.label, l.icon, l.exact, i))}
            </div>
          </div>
        </div>
      )}

      <div className="sse-mobile-dock fixed left-1/2 z-[60] -translate-x-1/2 lg:hidden">
        <div className="flex items-center rounded-2xl border border-slate-700/80 bg-[#111520]/95 p-1.5 shadow-[0_10px_35px_rgba(0,0,0,0.65)] backdrop-blur-md">
          {dockOpen ? (
            <div className="flex items-center gap-2 px-2">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input value={quickFilter} onChange={(e) => setQuickFilter(e.target.value)} placeholder="Find page..." className="w-36 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none" />
            </div>
          ) : (
            <button type="button" onClick={() => setDockOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800/80">
              <Search className="h-3.5 w-3.5 text-indigo-400" />
              <span>Find</span>
            </button>
          )}
          <div className="mx-1 h-5 w-px bg-slate-700/80" />
          <button type="button" onClick={() => setDockOpen((v) => !v)} aria-label="Toggle Menu" className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800/80">
            {dockOpen ? <X className="h-4 w-4 text-rose-400" /> : <Menu className="h-4 w-4 text-indigo-400" />}
            <span>Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}

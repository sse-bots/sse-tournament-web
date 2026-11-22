"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  RefreshCw,
  ArrowRight,
  Search,
  Bot,
  ShieldCheck,
  KeyRound,
  Trophy,
} from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { useArena } from "@/components/theme-provider";
import { useToast } from "@/components/ui/toast";
import type { ServerStatusInfo } from "@/lib/server-status";

function DashboardContent() {
  const { actor, setActiveGuildId } = useArena();
  const { push } = useToast();

  const [servers, setServers] = useState<ServerStatusInfo[]>([]);
  const [botInviteUrl, setBotInviteUrl] = useState("https://sse-nexus.vercel.app");
  const [nexusUrl, setNexusUrl] = useState("https://sse-nexus.vercel.app");
  const [loading, setLoading] = useState(true);
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState<ServerStatusInfo | null>(null);
  const [checking, setChecking] = useState(false);

  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/servers");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load servers");
      setServers(data.servers || []);
      if (data.botInviteUrl) setBotInviteUrl(data.botInviteUrl);
      if (data.nexusUrl) setNexusUrl(data.nexusUrl);
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  async function checkSpecificServer(e: React.FormEvent) {
    e.preventDefault();
    const clean = lookupId.trim();
    if (!clean) return;
    setChecking(true);
    setLookupResult(null);
    try {
      const res = await fetch(`/api/servers?checkGuildId=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server check failed");
      const found: ServerStatusInfo | undefined = data.servers?.[0];
      if (found) setLookupResult(found);
      if (data.botInviteUrl) setBotInviteUrl(data.botInviteUrl);
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setChecking(false);
    }
  }

  function renderServerCard(s: ServerStatusInfo) {
    const isGreen = s.readiness === "active";
    const isAmber = s.readiness === "needs_activation";

    return (
      <div
        key={s.guildId}
        className={`arena-card p-5 flex flex-col justify-between gap-4 transition-all ${
          isGreen
            ? "border-emerald-500/40 hover:border-emerald-500"
            : isAmber
              ? "border-amber-500/40"
              : "border-red-500/35"
        }`}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {s.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.iconUrl}
                  alt={s.name}
                  className="h-11 w-11 shrink-0 rounded-xl object-cover border border-[var(--arena-border)]"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--arena-elevated)] border border-[var(--arena-border)] font-display-caps font-bold text-amber-500">
                  <Server className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-display-caps text-base sm:text-lg font-bold truncate">{s.name}</h3>
                <div className="font-mono text-[11px] text-[var(--arena-muted)] truncate">
                  ID: {s.guildId}
                </div>
              </div>
            </div>

            {/* Readiness Pill */}
            <span
              className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                isGreen
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-500"
                  : isAmber
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-500"
                    : "border-red-500/40 bg-red-500/15 text-red-500"
              }`}
            >
              {isGreen ? (
                <><CheckCircle2 className="h-3 w-3" /> Active</>
              ) : isAmber ? (
                <><AlertTriangle className="h-3 w-3" /> Activate</>
              ) : (
                <><XCircle className="h-3 w-3" /> No Bot</>
              )}
            </span>
          </div>

          {/* Bot + Setup Status Checklist */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-[var(--arena-elevated)] px-2.5 py-2 flex items-center justify-between">
              <span className="text-[var(--arena-muted)]">Bot Installed</span>
              <strong className={s.botInstalled ? "text-emerald-500" : "text-red-500"}>
                {s.botInstalled ? "Yes" : "No"}
              </strong>
            </div>
            <div className="rounded-lg bg-[var(--arena-elevated)] px-2.5 py-2 flex items-center justify-between">
              <span className="text-[var(--arena-muted)]">Discord /setup</span>
              <strong className={s.setupComplete ? "text-emerald-500" : "text-amber-500"}>
                {s.setupComplete ? "Ready" : "Run /setup"}
              </strong>
            </div>
          </div>

          {isGreen && (
            <div className="flex items-center justify-between text-xs font-mono text-[var(--arena-muted)] pt-1">
              <span>{s.counts.tournaments} Tournaments</span>
              <span className="text-red-500 font-bold">{s.counts.live} Live</span>
              <span className="text-emerald-500 font-bold">{s.counts.openReg} Open</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2 border-t border-[var(--arena-border)]">
          {isGreen ? (
            <Link
              href={`/dashboard/${s.guildId}`}
              onClick={() => setActiveGuildId(s.guildId)}
              className="arena-btn-primary w-full text-xs"
            >
              <Trophy className="h-3.5 w-3.5" />
              Open Server Arena
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : isAmber ? (
            <div className="space-y-2">
              <a
                href={nexusUrl}
                target="_blank"
                rel="noreferrer"
                className="arena-btn-primary w-full text-xs"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Activate in SSE Nexus
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <p className="text-[10px] text-center text-[var(--arena-muted)]">
                Generate a key in SSE Nexus, then run <code>/activate</code> in Discord.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <a
                href={botInviteUrl}
                target="_blank"
                rel="noreferrer"
                className="arena-btn-secondary w-full text-xs border-red-500/40 text-red-400 hover:border-red-500"
              >
                <Bot className="h-3.5 w-3.5" />
                Install SSE Tournament Bot
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <p className="text-[10px] text-center text-[var(--arena-muted)]">
                Add the bot to your server, activate it, then click Refresh.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="arena-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-500">
            <ShieldCheck className="h-4 w-4" />
            Signed in as {actor?.name}
          </div>
          <h1 className="font-display-caps text-2xl sm:text-3xl font-extrabold">
            Select Your Discord Server
          </h1>
          <p className="text-xs sm:text-sm text-[var(--arena-muted)]">
            Servers with <strong>SSE Tournament Bot</strong> installed and activated appear in green. Select one to manage or join tournaments.
          </p>
        </div>

        <button
          type="button"
          onClick={loadServers}
          disabled={loading}
          className="arena-btn-secondary text-xs w-full sm:w-auto shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Status
        </button>
      </div>

      {/* Verify Any Server by Discord Server ID */}
      <form onSubmit={checkSpecificServer} className="arena-card p-4 sm:p-5 space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-cyan-500">
          Check Bot Status by Discord Server ID
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--arena-muted)]" />
            <input
              className="arena-input pl-9 font-mono text-xs sm:text-sm"
              placeholder="Paste Discord Server (Guild) ID — e.g. 123456789012345678"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
            />
          </div>
          <button type="submit" disabled={checking} className="arena-btn-primary text-xs sm:w-auto w-full">
            {checking ? "Checking..." : "Check Server"}
          </button>
        </div>

        {lookupResult && (
          <div className="pt-2 max-w-md">{renderServerCard(lookupResult)}</div>
        )}
      </form>

      {/* Server Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="arena-card h-52 animate-pulse bg-[var(--arena-elevated)]/50" />
          ))}
        </div>
      ) : servers.length === 0 ? (
        <div className="arena-card p-8 sm:p-12 text-center space-y-4">
          <Bot className="mx-auto h-10 w-10 text-amber-500" />
          <div className="space-y-1">
            <h2 className="font-display-caps text-xl font-bold">No Connected Servers Detected Yet</h2>
            <p className="text-xs sm:text-sm text-[var(--arena-muted)] max-w-md mx-auto">
              Invite <strong>SSE Tournament Bot</strong> to your Discord server, activate it with an SSE Nexus key, and run <code>/setup</code>—then tap Refresh.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-2.5">
            <a href={botInviteUrl} target="_blank" rel="noreferrer" className="arena-btn-primary text-xs">
              <Bot className="h-4 w-4" /> Invite SSE Tournament Bot <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a href={nexusUrl} target="_blank" rel="noreferrer" className="arena-btn-secondary text-xs">
              <KeyRound className="h-4 w-4" /> Open SSE Nexus <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map(renderServerCard)}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

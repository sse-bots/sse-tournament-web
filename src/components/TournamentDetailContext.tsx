"use client";

import type { CSSProperties } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Gamepad2,
  Lock,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  Swords,
  Trophy,
  Unlock,
} from "lucide-react";
import { FairPlayBadge, RoleBadge } from "@/components/RoleBadge";
import { useWorkspace } from "@/components/WorkspaceContext";
import {
  FORMAT_LABELS,
  SCORING_LABELS,
  STATUS_META,
  type AuditLogRow,
  type GuildChannelInfo,
  type GuildRoleInfo,
  type MatchRow,
  type RegistrationRow,
  type SupportTicketRow,
  type TeamRow,
  type TournamentAccessContext,
  type TournamentSummary,
} from "@/lib/tournament-types";

export interface FullTournamentPayload {
  tournament: TournamentSummary;
  registrations: RegistrationRow[];
  teams: TeamRow[];
  matches: MatchRow[];
  tickets: SupportTicketRow[];
  auditLogs: AuditLogRow[];
  myRegistration: RegistrationRow | null;
  access: TournamentAccessContext;
  discordRoles: GuildRoleInfo[];
  discordChannels: GuildChannelInfo[];
}

interface TournamentDetailContextValue {
  guildId: string;
  tournamentId: string;
  data: FullTournamentPayload | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  toast: string | null;
  showToast: (msg: string) => void;
  setError: (msg: string | null) => void;
  refresh: () => Promise<void>;
  runAction: (
    body: Record<string, unknown>,
    successMsg?: string
  ) => Promise<{ ok: boolean; json?: Record<string, unknown> }>;
}

const TournamentDetailContext =
  createContext<TournamentDetailContextValue | null>(null);

export function TournamentDetailProvider({
  guildId,
  tournamentId,
  children,
}: {
  guildId: string;
  tournamentId: string;
  children: React.ReactNode;
}) {
  const { refreshTournament, refreshServer } = useWorkspace();
  const [data, setData] = useState<FullTournamentPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4500);
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/tournaments/${encodeURIComponent(tournamentId)}`,
        { cache: "no-store", credentials: "include" }
      );
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.tournament) {
        setError(j?.error || "Tournament not found.");
        setData(null);
        return;
      }
      setData(j as FullTournamentPayload);
    } catch {
      setError("Network error while loading tournament data.");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const runAction = useCallback(
    async (body: Record<string, unknown>, successMsg?: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/tournaments/${encodeURIComponent(tournamentId)}`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
        const j = (await res.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        if (!res.ok) {
          setError(String(j.error || "Action failed."));
          return { ok: false, json: j };
        }
        await Promise.all([refresh(), refreshTournament(), refreshServer()]);
        if (successMsg) showToast(successMsg);
        else if (typeof j.message === "string") showToast(j.message);
        return { ok: true, json: j };
      } catch {
        setError("Network error while executing action.");
        return { ok: false };
      } finally {
        setBusy(false);
      }
    },
    [tournamentId, refresh, refreshTournament, refreshServer, showToast]
  );

  const t = data?.tournament;
  const access = data?.access;
  const st = t ? STATUS_META[t.status] || STATUS_META.draft : null;

  return (
    <TournamentDetailContext.Provider
      value={{
        guildId,
        tournamentId,
        data,
        loading,
        error,
        busy,
        toast,
        showToast,
        setError,
        refresh,
        runAction,
      }}
    >
      {loading && !data ? (
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="h-32 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60" />
            <div className="h-32 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60" />
            <div className="h-32 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60" />
          </div>
        </div>
      ) : !data || !t || !access || !st ? (
        <div className="mx-auto mt-10 max-w-md rounded-3xl border border-rose-500/40 bg-slate-900/75 p-8 text-center shadow-2xl">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-rose-400" />
          <h1 className="text-lg font-extrabold text-white">
            Tournament Not Found
          </h1>
          <p className="mt-2 text-xs text-slate-400">
            {error || "This tournament may have been deleted or moved."}
          </p>
          <Link
            href={`/servers/${guildId}/tournaments`}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
          >
            Back to Server Tournaments
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Persistent Tournament Workspace Header */}
          <section className="sse-arena-hero rounded-3xl border border-slate-800 p-5 shadow-xl sm:p-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-900 px-2.5 py-0.5 text-[11px] font-bold text-slate-200">
                    <Gamepad2 className="h-3 w-3 text-indigo-400" />
                    {t.gameName}
                  </span>
                  <span
                    className="sse-status-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                    style={
                      {
                        backgroundColor: st.bg,
                        "--pill-dark": st.color,
                        "--pill-light": st.lightColor,
                      } as CSSProperties
                    }
                  >
                    {st.pulse && (
                      <span className="sse-status-dot h-1.5 w-1.5 animate-pulse rounded-full" />
                    )}
                    {st.label}
                  </span>
                  <RoleBadge
                    role={access.role}
                    label={
                      access.isTournamentOwner
                        ? "Owner"
                        : access.isModerator
                          ? "Moderator"
                          : "Member"
                    }
                    compact
                  />
                  {access.isFairPlayLocked && <FairPlayBadge />}
                </div>

                <h1 className="truncate text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {t.name}
                </h1>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                  <span className="rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-0.5 font-semibold">
                    {FORMAT_LABELS[t.format]}
                    {t.format === "series" ? ` (Bo${t.seriesBestOf})` : ""}
                  </span>
                  <span className="rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-0.5 font-semibold capitalize">
                    {t.mode === "team"
                      ? `Teams (${t.teamSizeMin}–${t.teamSizeMax})`
                      : "Solo / 1v1"}
                  </span>
                  <span className="rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-0.5 font-semibold">
                    {SCORING_LABELS[t.scoring]}
                  </span>
                  <code className="font-mono text-[10px] text-slate-400">
                    ID: {t.id}
                  </code>
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={refresh}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-indigo-500 disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sync
                </button>

                <a
                  href={`/api/tournaments/${encodeURIComponent(t.id)}/export`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-indigo-500"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-400" />
                  CSV
                </a>

                {access.canManageTournament && t.status === "draft" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      runAction(
                        { action: "open_registration" },
                        "Registration is now OPEN! Announced in Discord."
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    Open Registration
                  </button>
                )}

                {access.canManageTournament && t.status === "registration" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      runAction(
                        { action: "close_registration" },
                        "Registration closed & team rosters locked."
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-md transition hover:bg-sky-500 disabled:opacity-50"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Close Registration
                  </button>
                )}

                {access.canManageTournament &&
                  t.status === "registration_closed" &&
                  t.counts.matches === 0 &&
                  t.format !== "custom" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          { action: "trigger_matchmaking" },
                          "Matchmaking queued! SSE Bot will generate matches & private rooms in ~15s."
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-md transition hover:bg-indigo-500 disabled:opacity-50"
                    >
                      <Swords className="h-3.5 w-3.5" />
                      Generate Matchmaking
                    </button>
                  )}

                {access.canManageTournament && t.status === "in_progress" && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          { action: "pause" },
                          "Tournament paused — submissions suspended."
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-amber-500 disabled:opacity-50"
                    >
                      <Pause className="h-3.5 w-3.5" />
                      Pause
                    </button>
                    <Link
                      href={`/servers/${guildId}/tournaments/${t.id}/standings`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-md transition hover:bg-emerald-500"
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      Declare Results
                    </Link>
                  </>
                )}

                {access.canManageTournament && t.status === "paused" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      runAction({ action: "resume" }, "Tournament resumed!")
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Resume
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Fair-Play Guard Banner */}
          {access.isFairPlayLocked && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <div>
                <strong className="font-extrabold text-white">
                  Fair-Play Conflict-of-Interest Lock Active:
                </strong>{" "}
                You are registered as a participant in this tournament, so
                manager/moderator approvals, match reviews, and result
                declarations are automatically disabled to keep play fair. Use{" "}
                <code className="font-mono text-rose-300">/unregister</code> in
                Discord if you wish to step down as a player and resume staff
                duties.
              </div>
            </div>
          )}

          {toast && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{toast}</span>
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-300">
              {error}
            </div>
          )}

          {children}
        </div>
      )}
    </TournamentDetailContext.Provider>
  );
}

export function useTournamentDetail(): TournamentDetailContextValue {
  const ctx = useContext(TournamentDetailContext);
  if (!ctx) {
    throw new Error(
      "useTournamentDetail must be used inside <TournamentDetailProvider>"
    );
  }
  return ctx;
}

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
  Crown,
  Download,
  Gamepad2,
  Lock,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  Swords,
  Unlock,
  X,
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
  myMatches: MatchRow[];
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
  openCloseTournamentModal: () => void;
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

  // Close Tournament Modal state
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeDeclareWinners, setCloseDeclareWinners] = useState(true);
  const [closeForce, setCloseForce] = useState(false);
  const [closeReason, setCloseReason] = useState("");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 5000);
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
        if (typeof j.message === "string" && j.message) showToast(j.message);
        else if (successMsg) showToast(successMsg);
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

  const openCloseTournamentModal = useCallback(() => {
    setCloseDeclareWinners(true);
    setCloseForce(false);
    setCloseReason("");
    setCloseModalOpen(true);
  }, []);

  const t = data?.tournament;
  const access = data?.access;
  const st = t ? STATUS_META[t.status] || STATUS_META.draft : null;
  const isStaff = Boolean(
    access?.canManageTournament || access?.canAssignModerators
  );
  const unresolvedCount = (data?.matches || []).filter((m) =>
    [
      "scheduled",
      "ready",
      "in_progress",
      "pending_review",
      "rejected",
      "disputed",
      "postponed",
    ].includes(m.status)
  ).length;
  const nextWeekNum =
    Math.max(0, ...(t?.weeks || []).map((w) => w.weekNumber)) + 1;

  async function handleConfirmCloseTournament() {
    const res = await runAction(
      {
        action: "close_tournament",
        declareResults: closeDeclareWinners,
        force: closeForce,
        reason: closeReason.trim() || undefined,
      },
      "Tournament closed! Bot is locking all week forums in Discord."
    );
    if (res.ok) {
      setCloseModalOpen(false);
    }
  }

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
        openCloseTournamentModal,
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
                  {t.weeks.length > 0 && (
                    <span className="rounded-lg border border-indigo-500/35 bg-indigo-500/15 px-2 py-0.5 font-bold text-indigo-300">
                      {t.weeks.length} Week{t.weeks.length === 1 ? "" : "s"}
                    </span>
                  )}
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
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${busy || loading ? "animate-spin" : ""}`}
                  />
                  {busy || loading ? "Syncing..." : "Sync"}
                </button>

                {isStaff && (
                  <a
                    href={`/api/tournaments/${encodeURIComponent(t.id)}/export`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-indigo-500"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-400" />
                    CSV
                  </a>
                )}

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
                  ["registration_closed", "matchmaking", "in_progress"].includes(
                    t.status
                  ) &&
                  t.format !== "custom" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction({
                          action: "trigger_matchmaking",
                          weekNumber: nextWeekNum,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-md transition hover:bg-indigo-500 disabled:opacity-50"
                    >
                      <Swords className="h-3.5 w-3.5" />
                      Generate Week {nextWeekNum}
                    </button>
                  )}

                {access.canManageTournament && t.status === "in_progress" && (
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

                {access.canManageTournament &&
                  !["completed", "cancelled", "archived"].includes(t.status) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={openCloseTournamentModal}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2 text-xs font-extrabold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      Close Tournament
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

          {/* Live Bot WebSync Feedback Banner (Staff Only) */}
          {isStaff && t.lastWebSync && (
            <div
              className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-2.5 text-[11px] font-semibold ${
                t.lastWebSync.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-300"
              }`}
            >
              <span className="flex items-center gap-2">
                {t.lastWebSync.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>
                  Bot Sync ({t.lastWebSync.action}): {t.lastWebSync.message}
                </span>
              </span>
              {t.lastWebSync.at && (
                <span className="text-[10px] opacity-80">
                  {new Date(t.lastWebSync.at).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              )}
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

          {/* Close Tournament Modal */}
          {closeModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
              onClick={() => setCloseModalOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg space-y-4 rounded-3xl border border-slate-700 bg-[#0b1120] p-6 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-300">
                      <Lock className="h-3 w-3" /> Close Tournament
                    </div>
                    <h2 className="mt-2 text-lg font-black text-white">
                      Close {t.name}
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      Closing locks all open Week Forums and match posts in
                      Discord so no further messages or submissions can be sent.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCloseModalOpen(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setCloseDeclareWinners(true)}
                    className={`rounded-2xl border p-3.5 text-left transition ${
                      closeDeclareWinners
                        ? "border-emerald-500 bg-emerald-500/15"
                        : "border-slate-800 bg-slate-950/70"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                      <Crown className="h-4 w-4 text-amber-400" />
                      Close &amp; Declare Winners
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Freeze podium standings, announce Top 3 in Discord, grant
                      award roles, and lock all week forums.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCloseDeclareWinners(false)}
                    className={`rounded-2xl border p-3.5 text-left transition ${
                      !closeDeclareWinners
                        ? "border-indigo-500 bg-indigo-500/15"
                        : "border-slate-800 bg-slate-950/70"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                      <Lock className="h-4 w-4 text-indigo-400" />
                      Close Forums Only
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Mark tournament completed and lock all week forums without
                      triggering a podium award announcement.
                    </p>
                  </button>
                </div>

                {closeDeclareWinners && unresolvedCount > 0 && (
                  <div className="space-y-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-200">
                    <div className="font-bold text-amber-300">
                      {unresolvedCount} unresolved match(es) remaining
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 font-bold text-white">
                      <input
                        type="checkbox"
                        checked={closeForce}
                        onChange={(e) => setCloseForce(e.target.checked)}
                        className="h-4 w-4 accent-indigo-500"
                      />
                      Force close and freeze standings anyway
                    </label>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-200">
                    Closing Note (Optional)
                  </label>
                  <input
                    value={closeReason}
                    onChange={(e) => setCloseReason(e.target.value)}
                    placeholder="e.g. Great season everyone! See you in Season 2."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setCloseModalOpen(false)}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      (closeDeclareWinners &&
                        unresolvedCount > 0 &&
                        !closeForce)
                    }
                    onClick={handleConfirmCloseTournament}
                    className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-extrabold text-white hover:bg-rose-500 disabled:opacity-50"
                  >
                    {busy ? "Closing..." : "Confirm Close Tournament"}
                  </button>
                </div>
              </div>
            </div>
          )}
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

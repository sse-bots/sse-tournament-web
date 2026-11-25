"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Edit3,
  Flag,
  Image as ImageIcon,
  LayoutGrid,
  List,
  MapPin,
  Plus,
  ShieldAlert,
  Swords,
  X,
  XCircle,
} from "lucide-react";
import { BracketBoard } from "@/components/BracketBoard";
import { useTournamentDetail } from "@/components/TournamentDetailContext";
import { MATCH_STATUS_COLORS, type MatchRow } from "@/lib/tournament-types";

type ViewMode = "board" | "list";
type MatchFilter = "all" | "needs_review" | "active" | "completed" | "disputed";

export default function TournamentMatchesPage() {
  const { data, busy, refresh, runAction, showToast, setError } =
    useTournamentDetail();

  const [view, setView] = useState<ViewMode>("board");
  const [filter, setFilter] = useState<MatchFilter>("all");
  const [roundFilter, setRoundFilter] = useState<string>("all");
  const [matchBusyId, setMatchBusyId] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<MatchRow | null>(null);

  // Create custom match modal
  const [createOpen, setCreateOpen] = useState(false);
  const [sideAId, setSideAId] = useState("");
  const [sideBId, setSideBId] = useState("");
  const [newMap, setNewMap] = useState("");
  const [newBracketId, setNewBracketId] = useState("");
  const [newRound, setNewRound] = useState(1);
  const [newSchedule, setNewSchedule] = useState("");
  const [creatingMatch, setCreatingMatch] = useState(false);

  // Review / Forfeit / Override / Edit modal
  const [actionModal, setActionModal] = useState<{
    match: MatchRow;
    mode: "forfeit" | "override" | "edit" | "reject" | "dispute";
  } | null>(null);
  const [modalWinner, setModalWinner] = useState<"A" | "B">("A");
  const [modalNote, setModalNote] = useState("");
  const [modalMap, setModalMap] = useState("");
  const [modalStatus, setModalStatus] = useState("scheduled");
  const [modalSchedule, setModalSchedule] = useState("");

  const t = data?.tournament;
  const access = data?.access;
  const matches = useMemo(() => data?.matches || [], [data?.matches]);
  const registrations = useMemo(
    () =>
      (data?.registrations || []).filter((r) => r.status === "registered"),
    [data?.registrations]
  );
  const activeTeams = useMemo(
    () => (data?.teams || []).filter((tm) => tm.status === "active"),
    [data?.teams]
  );

  const rounds = useMemo(() => {
    const set = new Set<number>(matches.map((m) => m.roundNumber || 1));
    return Array.from(set).sort((a, b) => a - b);
  }, [matches]);

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (roundFilter !== "all" && String(m.roundNumber) !== roundFilter) {
        return false;
      }
      if (filter === "needs_review") {
        return ["pending_review", "disputed"].includes(m.status);
      }
      if (filter === "active") {
        return [
          "scheduled",
          "ready",
          "in_progress",
          "pending_proof",
          "postponed",
        ].includes(m.status);
      }
      if (filter === "completed") {
        return ["approved", "forfeited", "cancelled"].includes(m.status);
      }
      if (filter === "disputed") {
        return m.status === "disputed";
      }
      return true;
    });
  }, [matches, filter, roundFilter]);

  if (!data || !t || !access) return null;

  const canManage = access.canManageTournament;
  const needsReviewCount = matches.filter((m) =>
    ["pending_review", "disputed"].includes(m.status)
  ).length;

  async function patchMatch(
    matchId: string,
    payload: Record<string, unknown>,
    successMsg: string
  ) {
    setMatchBusyId(matchId);
    setError(null);
    try {
      const res = await fetch(
        `/api/tournaments/${encodeURIComponent(t!.id)}/matches`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId, ...payload }),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Match action failed.");
        return;
      }
      setActionModal(null);
      showToast(successMsg);
      await refresh();
    } finally {
      setMatchBusyId(null);
    }
  }

  async function handleCreateCustomMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!sideAId || !sideBId) return;
    setCreatingMatch(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tournaments/${encodeURIComponent(t!.id)}/matches`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sideAId,
            sideBId,
            mapName: newMap.trim(),
            bracketId: newBracketId || null,
            roundNumber: newRound,
            scheduledAt: newSchedule ? new Date(newSchedule).toISOString() : null,
          }),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not create custom match.");
        return;
      }
      setCreateOpen(false);
      setSideAId("");
      setSideBId("");
      setNewMap("");
      setNewSchedule("");
      showToast(
        `Match #${j.matchNumber} created! SSE Bot will spin up its private Discord room shortly.`
      );
      await refresh();
    } finally {
      setCreatingMatch(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col justify-between gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => setView("board")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                view === "board"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Bracket Board
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                view === "list"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Match List
              {needsReviewCount > 0 && canManage && (
                <span className="rounded-full bg-rose-500/25 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-300">
                  {needsReviewCount}
                </span>
              )}
            </button>
          </div>

          {view === "list" && (
            <select
              value={roundFilter}
              onChange={(e) => setRoundFilter(e.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="all">All Rounds</option>
              {rounds.map((r) => (
                <option key={r} value={String(r)}>
                  Round {r}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Staff Controls */}
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            {["registration_closed", "matchmaking"].includes(t.status) &&
              t.format !== "custom" &&
              matches.length === 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      { action: "trigger_matchmaking" },
                      "Matchmaking queued! Bot will create pairings & private rooms within ~15 seconds."
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Swords className="h-3.5 w-3.5" />
                  Generate Matchmaking
                </button>
              )}

            {["registration_closed", "matchmaking", "in_progress"].includes(
              t.status
            ) && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-md hover:bg-indigo-500"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Match
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pending Review Queue Banner for Staff */}
      {canManage && needsReviewCount > 0 && view === "board" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              <strong className="text-white">{needsReviewCount}</strong>{" "}
              match(es) have submitted proof or an active dispute awaiting
              moderator review.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setView("list");
              setFilter("needs_review");
            }}
            className="rounded-xl bg-amber-600 px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-amber-500"
          >
            Review Now
          </button>
        </div>
      )}

      {/* Visual Bracket View */}
      {view === "board" ? (
        <BracketBoard matches={matches} brackets={t.brackets} />
      ) : (
        <div className="space-y-4">
          {/* Status Filter Pills */}
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                { id: "all", label: `All (${matches.length})` },
                { id: "needs_review", label: `Needs Review (${needsReviewCount})` },
                { id: "active", label: "Active / Scheduled" },
                { id: "completed", label: "Completed" },
                { id: "disputed", label: "Disputed" },
              ] as Array<{ id: MatchFilter; label: string }>
            ).map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setFilter(pill.id)}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  filter === pill.id
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-800 bg-slate-900 text-slate-300 hover:border-indigo-500/50"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {filteredMatches.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-10 text-center text-xs text-slate-400">
              No matches in this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMatches.map((m) => {
                const st =
                  MATCH_STATUS_COLORS[m.status] || MATCH_STATUS_COLORS.scheduled;
                const isBusy = matchBusyId === m.id;
                const canReview =
                  canManage && ["pending_review", "disputed"].includes(m.status);
                const isFinal = ["approved", "forfeited", "cancelled"].includes(
                  m.status
                );

                return (
                  <div
                    key={m.id}
                    className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5"
                  >
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-indigo-400">
                            Match #{String(m.matchNumber).padStart(3, "0")}
                          </span>
                          <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                            Round {m.roundNumber}
                          </span>
                          {m.bracketName && (
                            <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              {m.bracketName}
                            </span>
                          )}
                          {m.seriesIndex && m.seriesBestOf && (
                            <span className="rounded-lg bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                              Game {m.seriesIndex} / Bo{m.seriesBestOf}
                            </span>
                          )}
                          <span
                            className="sse-status-pill rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase"
                            style={
                              {
                                backgroundColor: st.bg,
                                "--pill-dark": st.color,
                                "--pill-light": st.lightColor,
                              } as CSSProperties
                            }
                          >
                            {st.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-white">
                          <span
                            className={
                              m.reportedWinnerSide === "A" && isFinal
                                ? "text-emerald-300"
                                : ""
                            }
                          >
                            [A] {m.sideALabel}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            vs
                          </span>
                          <span
                            className={
                              m.reportedWinnerSide === "B" && isFinal
                                ? "text-emerald-300"
                                : m.isBye
                                  ? "italic text-slate-500"
                                  : ""
                            }
                          >
                            [B] {m.sideBLabel}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-indigo-400" />
                            {m.mapName}
                          </span>
                          {m.scheduledAt && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(m.scheduledAt).toLocaleString("en-IN")}
                            </span>
                          )}
                          {m.reportedWinnerSide && (
                            <span>
                              · Reported Winner:{" "}
                              <strong className="text-white">
                                Side {m.reportedWinnerSide}
                              </strong>
                            </span>
                          )}
                          {m.proofUrl && (
                            <button
                              type="button"
                              onClick={() => setProofPreview(m)}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-2 py-0.5 font-bold text-indigo-300 hover:bg-indigo-500/20"
                            >
                              <ImageIcon className="h-3 w-3" />
                              View Screenshot
                            </button>
                          )}
                        </div>

                        {m.reviewNote && (
                          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-[11px] text-slate-300">
                            <strong>Note: </strong>
                            {m.reviewNote}
                          </div>
                        )}
                      </div>

                      {/* Staff Operations */}
                      {canManage && !m.isBye && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {canReview && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  patchMatch(
                                    m.id,
                                    {
                                      action: "approve",
                                      winnerSide: m.reportedWinnerSide || "A",
                                    },
                                    `Match #${m.matchNumber} approved! Standings & next rounds synced.`
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-emerald-500 disabled:opacity-50"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Approve ({m.reportedWinnerSide || "A"})
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setModalNote("");
                                  setActionModal({ match: m, mode: "reject" });
                                }}
                                className="inline-flex items-center gap-1 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-300"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Reject
                              </button>
                              {m.status !== "disputed" && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => {
                                    setModalNote("");
                                    setActionModal({ match: m, mode: "dispute" });
                                  }}
                                  className="inline-flex items-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/15 px-3 py-1.5 text-[11px] font-bold text-amber-300"
                                >
                                  <ShieldAlert className="h-3.5 w-3.5" />
                                  Dispute
                                </button>
                              )}
                            </>
                          )}

                          {!isFinal && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setModalWinner("A");
                                  setModalNote("");
                                  setActionModal({ match: m, mode: "forfeit" });
                                }}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:border-amber-500/50"
                              >
                                <Flag className="h-3.5 w-3.5 text-amber-400" />
                                Forfeit
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setModalMap(m.mapName);
                                  setModalStatus(m.status);
                                  setModalSchedule(
                                    m.scheduledAt
                                      ? m.scheduledAt.slice(0, 16)
                                      : ""
                                  );
                                  setActionModal({ match: m, mode: "edit" });
                                }}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:border-indigo-500"
                              >
                                <Edit3 className="h-3.5 w-3.5 text-indigo-400" />
                                Edit
                              </button>
                            </>
                          )}

                          {isFinal && !m.seriesId && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                setModalWinner(
                                  m.reportedWinnerSide === "A" ? "B" : "A"
                                );
                                setModalNote("");
                                setActionModal({ match: m, mode: "override" });
                              }}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:border-amber-500"
                            >
                              Override Winner
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Proof Lightbox */}
      {proofPreview?.proofUrl && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setProofPreview(null)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-700 bg-[#0b1120] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
              <div>
                <div className="text-sm font-bold text-white">
                  Match #{String(proofPreview.matchNumber).padStart(3, "0")}{" "}
                  Proof Evidence
                </div>
                <div className="text-[11px] text-slate-400">
                  {proofPreview.sideALabel} vs {proofPreview.sideBLabel}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProofPreview(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto bg-slate-950 p-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proofPreview.proofUrl}
                alt="Match proof"
                className="mx-auto max-h-[65vh] rounded-2xl object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Match Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setCreateOpen(false)}
        >
          <form
            onSubmit={handleCreateCustomMatch}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg space-y-4 rounded-3xl border border-slate-700 bg-[#0b1120] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-white">
                  Create Custom Match
                </h2>
                <p className="text-[11px] text-slate-400">
                  SSE Bot will automatically create a private Discord match room
                  for the participants.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-200">
                  Side A ({t.mode === "team" ? "Team" : "Player"}) *
                </label>
                <select
                  required
                  value={sideAId}
                  onChange={(e) => setSideAId(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="">Select Side A...</option>
                  {t.mode === "team"
                    ? activeTeams.map((tm) => (
                        <option key={tm.id} value={tm.id}>
                          {tm.name}
                        </option>
                      ))
                    : registrations.map((r) => (
                        <option key={r.id} value={r.userId}>
                          {r.inGameId || r.discordDisplayName || r.userId}
                        </option>
                      ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-200">
                  Side B ({t.mode === "team" ? "Team" : "Player"}) *
                </label>
                <select
                  required
                  value={sideBId}
                  onChange={(e) => setSideBId(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="">Select Side B...</option>
                  {t.mode === "team"
                    ? activeTeams
                        .filter((tm) => tm.id !== sideAId)
                        .map((tm) => (
                          <option key={tm.id} value={tm.id}>
                            {tm.name}
                          </option>
                        ))
                    : registrations
                        .filter((r) => r.userId !== sideAId)
                        .map((r) => (
                          <option key={r.id} value={r.userId}>
                            {r.inGameId || r.discordDisplayName || r.userId}
                          </option>
                        ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-200">
                  Map Name
                </label>
                <input
                  value={newMap}
                  onChange={(e) => setNewMap(e.target.value)}
                  placeholder={t.maps[0] || "Auto-rotated map"}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-200">
                  Round Number
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={newRound}
                  onChange={(e) => setNewRound(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            {t.bracketsEnabled && t.brackets.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-200">
                  Power Bracket
                </label>
                <select
                  value={newBracketId}
                  onChange={(e) => setNewBracketId(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="">No bracket</option>
                  {t.brackets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-200">
                Scheduled Time (Optional)
              </label>
              <input
                type="datetime-local"
                value={newSchedule}
                onChange={(e) => setNewSchedule(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingMatch || !sideAId || !sideBId}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-extrabold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {creatingMatch ? "Creating..." : "Create Match"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Match Action Modal (Forfeit / Override / Reject / Dispute / Edit) */}
      {actionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setActionModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-3xl border border-slate-700 bg-[#0b1120] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold capitalize text-white">
                {actionModal.mode} Match #
                {String(actionModal.match.matchNumber).padStart(3, "0")}
              </h2>
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {(actionModal.mode === "forfeit" ||
              actionModal.mode === "override") && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-200">
                  Award Victory To
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalWinner("A")}
                    className={`rounded-xl border p-2.5 text-xs font-bold ${
                      modalWinner === "A"
                        ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                        : "border-slate-800 bg-slate-950 text-slate-300"
                    }`}
                  >
                    Side A: {actionModal.match.sideALabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalWinner("B")}
                    className={`rounded-xl border p-2.5 text-xs font-bold ${
                      modalWinner === "B"
                        ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                        : "border-slate-800 bg-slate-950 text-slate-300"
                    }`}
                  >
                    Side B: {actionModal.match.sideBLabel}
                  </button>
                </div>
              </div>
            )}

            {actionModal.mode === "edit" ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-200">
                    Map Name
                  </label>
                  <input
                    value={modalMap}
                    onChange={(e) => setModalMap(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-200">
                    Match Status
                  </label>
                  <select
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="ready">Ready to Play</option>
                    <option value="in_progress">In Progress</option>
                    <option value="pending_proof">Pending Proof</option>
                    <option value="postponed">Postponed</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-200">
                    Scheduled Time
                  </label>
                  <input
                    type="datetime-local"
                    value={modalSchedule}
                    onChange={(e) => setModalSchedule(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-200">
                  Audit Reason / Note
                </label>
                <textarea
                  rows={3}
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder="Provide a clear reason logged in audit history..."
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-white"
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={matchBusyId === actionModal.match.id}
                onClick={async () => {
                  if (actionModal.mode === "edit") {
                    await patchMatch(
                      actionModal.match.id,
                      {
                        action: "edit",
                        mapName: modalMap.trim() || undefined,
                        scheduledAt: modalSchedule
                          ? new Date(modalSchedule).toISOString()
                          : undefined,
                      },
                      "Match map/schedule updated!"
                    );
                    if (modalStatus !== actionModal.match.status) {
                      await patchMatch(
                        actionModal.match.id,
                        { action: "set_status", status: modalStatus },
                        `Match status updated to ${modalStatus}.`
                      );
                    }
                  } else if (actionModal.mode === "forfeit") {
                    await patchMatch(
                      actionModal.match.id,
                      {
                        action: "forfeit",
                        winnerSide: modalWinner,
                        note: modalNote.trim(),
                      },
                      `Forfeit awarded to Side ${modalWinner}.`
                    );
                  } else if (actionModal.mode === "override") {
                    await patchMatch(
                      actionModal.match.id,
                      {
                        action: "override",
                        winnerSide: modalWinner,
                        note: modalNote.trim(),
                      },
                      `Winner overridden to Side ${modalWinner}.`
                    );
                  } else {
                    await patchMatch(
                      actionModal.match.id,
                      {
                        action: actionModal.mode,
                        note: modalNote.trim(),
                      },
                      `Match marked ${actionModal.mode}.`
                    );
                  }
                }}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-extrabold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

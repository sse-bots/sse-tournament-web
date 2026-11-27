"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Flag,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Lock,
  MapPin,
  Megaphone,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Swords,
  Unlock,
  X,
  XCircle,
} from "lucide-react";
import { AnnouncementComposer } from "@/components/AnnouncementComposer";
import { BracketBoard } from "@/components/BracketBoard";
import { ConfirmModal } from "@/components/ConfirmModal";
import { CustomSelect } from "@/components/CustomSelect";
import { useTournamentDetail } from "@/components/TournamentDetailContext";
import {
  FORUM_TAG_META,
  type MatchForumTag,
  type MatchRow,
} from "@/lib/tournament-types";

type ViewMode = "list" | "board";
type MatchFilter = "all" | "submitted" | "pending" | "issue" | "declared";

export default function TournamentMatchesPage() {
  const { data, busy, refresh, runAction, showToast, setError } =
    useTournamentDetail();

  const [view, setView] = useState<ViewMode>("list");
  const [filter, setFilter] = useState<MatchFilter>("all");
  const [weekFilter, setWeekFilter] = useState<string>("all");
  const [matchSearch, setMatchSearch] = useState<string>("");
  const [remindWeekNum, setRemindWeekNum] = useState<number | null>(null);
  const [matchBusyId, setMatchBusyId] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<MatchRow | null>(null);

  // Week Announcement & Close Week confirmation modals
  const [weekAnnounceNum, setWeekAnnounceNum] = useState<number | null>(null);
  const [weekAnnounceMsg, setWeekAnnounceMsg] = useState("");
  const [weekBroadcastAll, setWeekBroadcastAll] = useState(true);
  const [weekAlsoServer, setWeekAlsoServer] = useState(false);
  const [weekIncludeHeader, setWeekIncludeHeader] = useState(true);
  const [closeWeekNum, setCloseWeekNum] = useState<number | null>(null);

  // Create custom match modal
  const [createOpen, setCreateOpen] = useState(false);
  const [sideAId, setSideAId] = useState("");
  const [sideBId, setSideBId] = useState("");
  const [newMap, setNewMap] = useState("");
  const [newBracketId, setNewBracketId] = useState("");
  const [newWeek, setNewWeek] = useState(1);
  const [newRound, setNewRound] = useState(1);
  const [newSchedule, setNewSchedule] = useState("");
  const [creatingMatch, setCreatingMatch] = useState(false);

  // Match Action Modal (Forfeit / Override / Reject / Dispute / Edit)
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

  const weekNumbers = useMemo(() => {
    const s = new Set<number>();
    for (const w of t?.weeks || []) s.add(w.weekNumber);
    for (const m of matches) s.add(m.weekNumber || 1);
    return Array.from(s).sort((a, b) => a - b);
  }, [t?.weeks, matches]);

  const filteredMatches = useMemo(() => {
    const q = matchSearch.trim().toLowerCase();
    return matches.filter((m) => {
      if (weekFilter !== "all" && String(m.weekNumber || 1) !== weekFilter) {
        return false;
      }
      if (filter !== "all" && m.forumTag !== filter) {
        return false;
      }
      if (!q) return true;
      return (
        m.sideALabel.toLowerCase().includes(q) ||
        m.sideBLabel.toLowerCase().includes(q) ||
        m.mapName.toLowerCase().includes(q) ||
        (m.bracketName || "").toLowerCase().includes(q) ||
        `match ${m.weekMatchNumber}`.includes(q) ||
        `#${m.weekMatchNumber}`.includes(q)
      );
    });
  }, [matches, filter, weekFilter, matchSearch]);

  if (!data || !t || !access) return null;

  const isStaff = access.canManageTournament || access.canAssignModerators;
  if (!isStaff) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-amber-500/40 bg-slate-900/75 p-8 text-center">
        <Lock className="mx-auto mb-3 h-9 w-9 text-amber-400" />
        <h2 className="text-base font-extrabold text-white">
          Staff Only — Matches &amp; Weeks Operations
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
          This section is restricted to the Server Owner and assigned Tournament
          Moderators. View your own matches, Discord forum post links, and live
          standings in My Match &amp; Info.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href={`/servers/${t.guildId}/tournaments/${t.id}`}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
          >
            My Match &amp; Info
          </Link>
          <Link
            href={`/servers/${t.guildId}/tournaments/${t.id}/standings`}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:border-indigo-500"
          >
            Standings &amp; Results
          </Link>
        </div>
      </div>
    );
  }

  const canManage = access.canManageTournament;
  const submittedCount = matches.filter((m) => m.forumTag === "submitted").length;
  const issueCount = matches.filter((m) => m.forumTag === "issue").length;
  const nextWeekNum = (weekNumbers.length > 0 ? Math.max(...weekNumbers) : 0) + 1;

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
            weekNumber: newWeek,
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
        `Week ${j.weekNumber} · Match #${j.weekMatchNumber ?? j.matchNumber} added! Bot will create the forum post (~15s).`
      );
      await refresh();
    } finally {
      setCreatingMatch(false);
    }
  }

  async function handleSendWeekAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!weekAnnounceNum || !weekAnnounceMsg.trim()) return;
    const res = await runAction({
      action: "send_announcement",
      weekNumber: weekAnnounceNum,
      announcementMessage: weekAnnounceMsg.trim(),
      broadcastToMatches: weekBroadcastAll,
      alsoPostServerChannel: weekAlsoServer,
      includeHeader: weekIncludeHeader,
    });
    if (res.ok) {
      setWeekAnnounceNum(null);
      setWeekAnnounceMsg("");
    }
  }

  return (
    <div className="space-y-5">
      {/* WEEKS & DISCORD FORUM CONTROL PANEL */}
      <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
              <MessageSquare className="h-4 w-4 text-indigo-400" />
              Weeks &amp; Discord Forum Channels
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Each matchmaking run creates a dedicated Discord Forum (Week 1,
              Week 2...) with a locked Announcements post and tagged match posts
              (Pending → Submitted → Results Declared).
            </p>
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              {["registration_closed", "matchmaking", "in_progress"].includes(
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
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <Swords className="h-3.5 w-3.5" />
                    Generate Week {nextWeekNum} Matchmaking
                  </button>
                )}

              {["registration_closed", "matchmaking", "in_progress"].includes(
                t.status
              ) && (
                <button
                  type="button"
                  onClick={() => {
                    setNewWeek(Math.max(1, ...weekNumbers));
                    setCreateOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-md hover:bg-indigo-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Custom Match
                </button>
              )}
            </div>
          )}
        </div>

        {t.weeks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-5 text-center text-xs text-slate-400">
            No Week Forums yet. Close registration, approve at least 2 players&apos;
            Squad Power, and click{" "}
            <strong className="text-white">Generate Week 1 Matchmaking</strong>.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {t.weeks.map((wk) => {
              const wkMatches = matches.filter(
                (m) => (m.weekNumber || 1) === wk.weekNumber
              );
              const declaredInWk = wkMatches.filter(
                (m) => m.forumTag === "declared"
              ).length;
              const isClosed = wk.status === "closed";

              return (
                <div
                  key={wk.weekNumber}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/75 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">
                          Week {wk.weekNumber}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                            isClosed
                              ? "bg-slate-800 text-slate-400"
                              : "bg-emerald-500/15 text-emerald-300"
                          }`}
                        >
                          {isClosed ? "Closed & Locked" : "Open"}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        <strong className="text-white">{wkMatches.length}</strong>{" "}
                        matches ·{" "}
                        <strong className="text-emerald-400">
                          {declaredInWk}
                        </strong>{" "}
                        declared
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {wk.forumUrl && (
                        <a
                          href={wk.forumUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-white hover:border-indigo-500"
                        >
                          Forum <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {wk.announcementThreadUrl && (
                        <a
                          href={wk.announcementThreadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300"
                        >
                          Locked Post <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setWeekAnnounceNum(wk.weekNumber);
                          setWeekAnnounceMsg("");
                          setWeekBroadcastAll(true);
                          setWeekAlsoServer(false);
                          setWeekIncludeHeader(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-[11px] font-bold text-indigo-300 hover:bg-indigo-500/20"
                      >
                        <Megaphone className="h-3.5 w-3.5" />
                        Announce to Week {wk.weekNumber}
                      </button>

                      {!isClosed && weekPending > 0 && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setRemindWeekNum(wk.weekNumber)}
                          className="inline-flex items-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
                        >
                          <Bell className="h-3.5 w-3.5" />
                          Remind Pending ({weekPending})
                        </button>
                      )}

                      {!isClosed ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setCloseWeekNum(wk.weekNumber)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-300 disabled:opacity-50"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          Close Week
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runAction({
                              action: "reopen_week",
                              weekNumber: wk.weekNumber,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:border-emerald-500 disabled:opacity-50"
                        >
                          <Unlock className="h-3.5 w-3.5 text-emerald-400" />
                          Reopen Week
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* VIEW SWITCH & FILTERS */}
      <div className="flex flex-col justify-between gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-800 bg-slate-950 p-1">
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
              Match Operations
              {submittedCount + issueCount > 0 && (
                <span className="rounded-full bg-rose-500/25 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-300">
                  {submittedCount + issueCount}
                </span>
              )}
            </button>
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
          </div>

          {weekNumbers.length > 0 && (
            <CustomSelect
              className="min-w-[150px]"
              value={weekFilter}
              onChange={setWeekFilter}
              searchable={false}
              options={[
                { value: "all", label: `All Weeks (${weekNumbers.length})` },
                ...weekNumbers.map((w) => ({
                  value: String(w),
                  label: `Week ${w}`,
                })),
              ]}
            />
          )}
        </div>

        {/* Match Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            value={matchSearch}
            onChange={(e) => setMatchSearch(e.target.value)}
            placeholder="Search player, team, map, or #..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-8 pr-7 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          {matchSearch && (
            <button
              type="button"
              onClick={() => setMatchSearch("")}
              className="absolute right-2 top-2 rounded-md p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Forum Tag Filter Pills */}
        {view === "list" && (
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                { id: "all", label: `All (${matches.length})` },
                { id: "submitted", label: `Submitted (${submittedCount})` },
                { id: "issue", label: `Issue (${issueCount})` },
                { id: "pending", label: "Pending" },
                { id: "declared", label: "Results Declared" },
              ] as Array<{ id: MatchFilter; label: string }>
            ).map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setFilter(pill.id)}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  filter === pill.id
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-800 bg-slate-950 text-slate-300 hover:border-indigo-500/50"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* BOARD OR OPERATIONS LIST */}
      {view === "board" ? (
        <BracketBoard matches={filteredMatches} brackets={t.brackets} />
      ) : filteredMatches.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-10 text-center text-xs text-slate-400">
          No matches in this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMatches.map((m) => {
            const tagKey = (m.forumTag || "pending") as MatchForumTag;
            const tagMeta = FORUM_TAG_META[tagKey] || FORUM_TAG_META.pending;
            const isBusy = matchBusyId === m.id;
            const canReview =
              canManage && ["pending_review", "disputed"].includes(m.status);
            const isFinal = ["approved", "forfeited", "cancelled"].includes(
              m.status
            );
            const reportedName =
              m.reportedWinnerLabel ||
              (m.reportedWinnerSide === "A"
                ? m.sideALabel
                : m.reportedWinnerSide === "B"
                  ? m.sideBLabel
                  : m.reportedWinnerSide === "DRAW"
                    ? "Draw"
                    : null);

            return (
              <div
                key={m.id}
                className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5"
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-extrabold text-indigo-300">
                        Week {m.weekNumber || 1}
                      </span>
                      <span className="font-mono text-xs font-extrabold text-white">
                        Match #{m.weekMatchNumber}
                      </span>
                      {m.bracketName && (
                        <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                          {m.bracketName}
                        </span>
                      )}
                      {m.seriesIndex && m.seriesBestOf && (
                        <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                          Game {m.seriesIndex} / Bo{m.seriesBestOf}
                        </span>
                      )}
                      <span
                        className="sse-status-pill rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase"
                        style={
                          {
                            backgroundColor: tagMeta.bg,
                            "--pill-dark": tagMeta.color,
                            "--pill-light": tagMeta.lightColor,
                          } as CSSProperties
                        }
                      >
                        {tagMeta.label}
                      </span>
                    </div>

                    {/* REAL NAMES — never generic Side A / Side B */}
                    <div className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-white">
                      <span
                        className={
                          m.reportedWinnerSide === "A" && isFinal
                            ? "text-emerald-300"
                            : ""
                        }
                      >
                        {m.sideALabel}
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
                        {m.sideBLabel}
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
                      {reportedName && (
                        <span>
                          · {isFinal ? "Declared Winner" : "Reported Winner"}:{" "}
                          <strong className="text-emerald-400">
                            {reportedName}
                          </strong>
                        </span>
                      )}
                      {m.threadUrl && (
                        <a
                          href={m.threadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-0.5 font-bold text-slate-200 hover:border-indigo-500 hover:text-white"
                        >
                          <MessageSquare className="h-3 w-3 text-indigo-400" />
                          Open Forum Post
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      {m.proofUrl && (
                        <button
                          type="button"
                          onClick={() => setProofPreview(m)}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-2 py-0.5 font-bold text-indigo-300 hover:bg-indigo-500/20"
                        >
                          <ImageIcon className="h-3 w-3" />
                          View Proof
                        </button>
                      )}
                    </div>

                    {(m.channelCreationError || (!m.threadUrl && !m.isBye)) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300">
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          {m.channelCreationError
                            ? `Forum post failed: ${m.channelCreationErrorMsg || "Check bot permissions."}`
                            : "Discord forum post pending creation..."}
                        </span>
                        {canManage && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              patchMatch(
                                m.id,
                                { action: "repair_forum" },
                                `Queued Discord forum post retry for Week ${m.weekNumber || 1} · Match #${m.weekMatchNumber} (~15s).`
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-500/20 px-2.5 py-1 text-[10px] font-extrabold text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Retry Forum Post
                          </button>
                        )}
                      </div>
                    )}

                    {m.reviewNote && (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-[11px] text-slate-300">
                        <strong>Note: </strong>
                        {m.reviewNote}
                      </div>
                    )}
                  </div>

                  {/* Staff Actions — Showing Real Player/Team Names */}
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
                                `Week ${m.weekNumber || 1} · Match #${m.weekMatchNumber} declared for ${reportedName || m.sideALabel}! Forum tag updated to Results Declared.`
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve {reportedName || m.sideALabel}
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
                              Issue
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

      {/* WEEK ANNOUNCEMENT MODAL */}
      {weekAnnounceNum !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setWeekAnnounceNum(null)}
        >
          <form
            onSubmit={handleSendWeekAnnouncement}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg space-y-4 rounded-3xl border border-slate-700 bg-[#0b1120] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-white">
                  Announce to Week {weekAnnounceNum}
                </h2>
                <p className="text-[11px] text-slate-400">
                  Posts inside the locked Week {weekAnnounceNum} Announcements
                  forum post (members cannot reply).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWeekAnnounceNum(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <AnnouncementComposer
              value={weekAnnounceMsg}
              onChange={setWeekAnnounceMsg}
              roles={data.discordRoles || []}
              channels={data.discordChannels || []}
              tournamentName={t.name}
              weekNumber={weekAnnounceNum}
              includeHeader={weekIncludeHeader}
              required
              disabled={busy}
              rows={4}
              placeholder={`Write your Week ${weekAnnounceNum} announcement... Type @ to mention roles or format with Bold/Italic`}
            />

            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-200">
                <input
                  type="checkbox"
                  checked={weekIncludeHeader}
                  onChange={(e) => setWeekIncludeHeader(e.target.checked)}
                  className="h-4 w-4 accent-indigo-500"
                />
                Include tournament name, &quot;Week {weekAnnounceNum} · Official Announcement&quot; header &amp; dividers
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-200">
                <input
                  type="checkbox"
                  checked={weekBroadcastAll}
                  onChange={(e) => setWeekBroadcastAll(e.target.checked)}
                  className="h-4 w-4 accent-indigo-500"
                />
                Broadcast into every match post in Week {weekAnnounceNum}
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-200">
                <input
                  type="checkbox"
                  checked={weekAlsoServer}
                  onChange={(e) => setWeekAlsoServer(e.target.checked)}
                  className="h-4 w-4 accent-indigo-500"
                />
                Also post in Server Announcement channel
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setWeekAnnounceNum(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || weekAnnounceMsg.trim().length < 2}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-extrabold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {busy ? "Sending..." : "Send Announcement"}
              </button>
            </div>
          </form>
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
                  Week {proofPreview.weekNumber || 1} · Match #{proofPreview.weekMatchNumber} Proof Evidence
                </div>
                <div className="text-[11px] text-slate-400">
                  {proofPreview.sideALabel} vs {proofPreview.sideBLabel} ·
                  Reported Winner:{" "}
                  <strong className="text-white">
                    {proofPreview.reportedWinnerLabel || "—"}
                  </strong>
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
                  SSE Bot will create a tagged match post inside the selected
                  Week Forum automatically.
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
                  Competitor 1 ({t.mode === "team" ? "Team" : "Player"}) *
                </label>
                <CustomSelect
                  value={sideAId}
                  onChange={setSideAId}
                  placeholder="Select Competitor 1..."
                  searchPlaceholder="Search competitor..."
                  searchable
                  options={[
                    { value: "", label: "Select Competitor 1..." },
                    ...(t.mode === "team"
                      ? activeTeams.map((tm) => ({
                          value: tm.id,
                          label: tm.name,
                        }))
                      : registrations.map((r) => ({
                          value: r.userId,
                          label: r.inGameId || r.discordDisplayName || r.userId,
                        }))),
                  ]}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-200">
                  Competitor 2 ({t.mode === "team" ? "Team" : "Player"}) *
                </label>
                <CustomSelect
                  value={sideBId}
                  onChange={setSideBId}
                  placeholder="Select Competitor 2..."
                  searchPlaceholder="Search competitor..."
                  searchable
                  options={[
                    { value: "", label: "Select Competitor 2..." },
                    ...(t.mode === "team"
                      ? activeTeams
                          .filter((tm) => tm.id !== sideAId)
                          .map((tm) => ({
                            value: tm.id,
                            label: tm.name,
                          }))
                      : registrations
                          .filter((r) => r.userId !== sideAId)
                          .map((r) => ({
                            value: r.userId,
                            label: r.inGameId || r.discordDisplayName || r.userId,
                          }))),
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-200">
                  Week Number
                </label>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={newWeek}
                  onChange={(e) => setNewWeek(Number(e.target.value))}
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
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-200">
                  Map Name
                </label>
                <input
                  value={newMap}
                  onChange={(e) => setNewMap(e.target.value)}
                  placeholder={t.maps[0] || "Auto"}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            {t.bracketsEnabled && t.brackets.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-200">
                  Power Bracket
                </label>
                <CustomSelect
                  value={newBracketId}
                  onChange={setNewBracketId}
                  searchable={t.brackets.length > 6}
                  options={[
                    { value: "", label: "No bracket" },
                    ...t.brackets.map((b) => ({
                      value: b.id,
                      label: b.name,
                    })),
                  ]}
                />
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

      {/* Match Action Modal (Real Player/Team Names!) */}
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
                {actionModal.mode} Week {actionModal.match.weekNumber || 1} · Match #{actionModal.match.weekMatchNumber}
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
                  Select Winner
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
                    🏆 {actionModal.match.sideALabel}
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
                    🏆 {actionModal.match.sideBLabel}
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
                  <CustomSelect
                    value={modalStatus}
                    onChange={setModalStatus}
                    searchable={false}
                    options={[
                      { value: "scheduled", label: "Pending / Scheduled" },
                      { value: "ready", label: "Ready to Play" },
                      { value: "in_progress", label: "In Progress" },
                      { value: "pending_proof", label: "Pending Proof" },
                      { value: "postponed", label: "Postponed" },
                    ]}
                  />
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
                  const chosenLabel =
                    modalWinner === "A"
                      ? actionModal.match.sideALabel
                      : actionModal.match.sideBLabel;
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
                      `Forfeit declared for ${chosenLabel}.`
                    );
                  } else if (actionModal.mode === "override") {
                    await patchMatch(
                      actionModal.match.id,
                      {
                        action: "override",
                        winnerSide: modalWinner,
                        note: modalNote.trim(),
                      },
                      `Winner overridden to ${chosenLabel}.`
                    );
                  } else {
                    await patchMatch(
                      actionModal.match.id,
                      {
                        action: actionModal.mode,
                        note: modalNote.trim(),
                      },
                      `Match marked ${actionModal.mode} (Forum tag set to Issue).`
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
          <ConfirmModal
        open={remindWeekNum !== null}
        title={remindWeekNum !== null ? `Ping Pending Matches in Week ${remindWeekNum}?` : "Remind Pending Matches"}
        description={
          remindWeekNum !== null
            ? `SSE Bot will ping the assigned players inside every unfinished match post in Week ${remindWeekNum} to submit their results.`
            : ""
        }
        confirmLabel="Send Reminder Ping"
        variant="primary"
        inputLabel="Custom Reminder Message (Optional)"
        inputPlaceholder="e.g. Please finish your match and drop screenshot proof before tonight!"
        busy={busy}
        onClose={() => setRemindWeekNum(null)}
        onConfirm={async (noteText) => {
          if (remindWeekNum === null) return;
          const res = await runAction({
            action: "remind_week_pending",
            weekNumber: remindWeekNum,
            reason: noteText || undefined,
          });
          if (res.ok) setRemindWeekNum(null);
        }}
      />

      <ConfirmModal
        open={closeWeekNum !== null}
        title={closeWeekNum !== null ? `Close Week ${closeWeekNum}?` : "Close Week"}
        description={
          closeWeekNum !== null
            ? `This will lock all match forum posts in Week ${closeWeekNum} and post an official closure notice in the locked Week ${closeWeekNum} Announcement post.`
            : ""
        }
        confirmLabel="Close & Lock Week"
        variant="warning"
        inputLabel="Closing Note (Optional)"
        inputPlaceholder="e.g. Week complete! Next week pairings coming soon."
        busy={busy}
        onClose={() => setCloseWeekNum(null)}
        onConfirm={async (reasonText) => {
          if (closeWeekNum === null) return;
          const res = await runAction({
            action: "close_week",
            weekNumber: closeWeekNum,
            reason: reasonText || undefined,
          });
          if (res.ok) setCloseWeekNum(null);
        }}
      />
    </div>
  );
}

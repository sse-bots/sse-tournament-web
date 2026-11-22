"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Hash,
  MapPin,
  Clock,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Flag,
  RotateCcw,
  ShieldAlert,
  ScrollText,
  Calendar,
} from "lucide-react";
import { TournamentDTO, MatchDTO, RegistrationDTO, AuditLogDTO } from "@/lib/types";
import { MatchStatusBadge } from "@/components/ui/badges";
import { useToast } from "@/components/ui/toast";

interface MatchPerms {
  isParticipant: boolean;
  canManage: boolean;
  canReview: boolean;
  isBotAdmin: boolean;
  discordId: string | null;
}

export default function MatchPostPage() {
  const params = useParams<{ id: string; matchId: string }>();
  const { id, matchId } = params;
  const { push } = useToast();

  const [tournament, setTournament] = useState<TournamentDTO | null>(null);
  const [match, setMatch] = useState<MatchDTO | null>(null);
  const [participants, setParticipants] = useState<RegistrationDTO[]>([]);
  const [seriesMatches, setSeriesMatches] = useState<MatchDTO[]>([]);
  const [history, setHistory] = useState<AuditLogDTO[]>([]);
  const [perms, setPerms] = useState<MatchPerms>({
    isParticipant: false,
    canManage: false,
    canReview: false,
    isBotAdmin: false,
    discordId: null,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Proof submission state
  const [winnerSide, setWinnerSide] = useState<"A" | "B" | "DRAW">("A");
  const [proofUrl, setProofUrl] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  // Manager edit state
  const [editMap, setEditMap] = useState("");
  const [editSched, setEditSched] = useState("");
  const [editStatus, setEditStatus] = useState("scheduled");

  const loadMatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${id}/matches/${matchId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Match post not found");
      setTournament(data.tournament);
      setMatch(data.match);
      setParticipants(data.participants || []);
      setSeriesMatches(data.seriesMatches || []);
      setHistory(data.history || []);
      setPerms(data.permissions);
      setEditMap(data.match.mapName || "");
      setEditSched(data.match.scheduledAt ? data.match.scheduledAt.slice(0, 16) : "");
      setEditStatus(data.match.status || "scheduled");
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [id, matchId, push]);

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  function handleProofFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return push("Attach an image screenshot.", "error");
    if (file.size > 2.5 * 1024 * 1024) return push("Keep screenshot under 2.5 MB or paste an HTTPS link.", "error");
    const reader = new FileReader();
    reader.onload = () => setProofUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${id}/matches/${matchId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: reviewNote, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      push(`Match updated: ${action.replace(/_/g, " ")}.`, "success");
      setReviewNote("");
      await loadMatch();
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveMatchMeta(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${id}/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapName: editMap,
          scheduledAt: editSched ? new Date(editSched).toISOString() : undefined,
          status: editStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      push("Match post schedule/map updated.", "success");
      await loadMatch();
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !tournament || !match) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-[var(--arena-muted)]">Loading match post...</div>;
  }

  const regMap = new Map(participants.map((p) => [p.userId, p]));
  const discordUrl = match.channelId
    ? `https://discord.com/channels/${match.guildId}/${match.channelId}`
    : null;
  const sideAName = match.sideATeamName || match.sideAUserIds.map((u) => regMap.get(u)?.inGameId || u).join(", ");
  const sideBName = match.sideBTeamName || (match.sideBUserIds.length ? match.sideBUserIds.map((u) => regMap.get(u)?.inGameId || u).join(", ") : "BYE");
  const canSubmit =
    perms.isParticipant &&
    ["scheduled", "ready", "rejected", "disputed", "in_progress", "pending_proof"].includes(match.status) &&
    !["paused", "completed", "cancelled", "archived"].includes(tournament.status);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/tournaments/${id}?tab=matches`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--arena-muted)] hover:text-amber-500">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {tournament.name}
        </Link>
        {discordUrl && (
          <a href={discordUrl} target="_blank" rel="noreferrer" className="arena-btn-secondary text-xs py-1.5">
            <Hash className="h-3.5 w-3.5 text-indigo-400" />
            Open Discord Match Post
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Broadcast VS Match Post Header */}
      <div className="arena-card overflow-hidden shadow-arena">
        <div className="border-b border-[var(--arena-border)] bg-[var(--arena-elevated)] px-5 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="font-display-caps text-base font-extrabold text-amber-500">
              MATCH #{String(match.matchNumber).padStart(3, "0")}
            </span>
            <span className="font-mono text-xs text-[var(--arena-muted)]">
              Round {match.roundNumber} {match.seriesBestOf && match.seriesBestOf > 1 ? `• Game ${match.seriesIndex} of Bo${match.seriesBestOf}` : ""}
            </span>
          </div>
          <MatchStatusBadge status={match.status} />
        </div>

        <div className="p-6 grid gap-4 md:grid-cols-7 items-center text-center">
          {/* Side A */}
          <div className={`md:col-span-3 rounded-xl border p-4 ${match.reportedWinnerSide === "A" && (match.status === "approved" || match.status === "forfeited") ? "border-emerald-500 bg-emerald-500/10" : "border-[var(--arena-border)] bg-[var(--arena-elevated)]/60"}`}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-500">Side A</div>
            <div className="font-display-caps text-xl sm:text-2xl font-extrabold mt-1 truncate">{sideAName}</div>
            <div className="font-mono text-xs text-[var(--arena-muted)] mt-1">
              {match.sideAPower ? `${Math.round(match.sideAPower).toLocaleString()} Avg SP` : ""}
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {match.sideAUserIds.map((uid) => (
                <span key={uid} className="rounded bg-[var(--arena-surface)] px-2 py-0.5 font-mono text-[10px] border border-[var(--arena-border)]">
                  {regMap.get(uid)?.inGameId || uid}
                </span>
              ))}
            </div>
          </div>

          {/* VS */}
          <div className="md:col-span-1 flex flex-col items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-500/50 bg-amber-500/15 font-display-caps text-lg font-extrabold text-amber-500">
              VS
            </div>
          </div>

          {/* Side B */}
          <div className={`md:col-span-3 rounded-xl border p-4 ${match.reportedWinnerSide === "B" && (match.status === "approved" || match.status === "forfeited") ? "border-emerald-500 bg-emerald-500/10" : "border-[var(--arena-border)] bg-[var(--arena-elevated)]/60"}`}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Side B</div>
            <div className="font-display-caps text-xl sm:text-2xl font-extrabold mt-1 truncate">{sideBName}</div>
            <div className="font-mono text-xs text-[var(--arena-muted)] mt-1">
              {match.sideBPower ? `${Math.round(match.sideBPower).toLocaleString()} Avg SP` : ""}
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {match.sideBUserIds.map((uid) => (
                <span key={uid} className="rounded bg-[var(--arena-surface)] px-2 py-0.5 font-mono text-[10px] border border-[var(--arena-border)]">
                  {regMap.get(uid)?.inGameId || uid}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Metadata Strip */}
        <div className="border-t border-[var(--arena-border)] bg-[var(--arena-elevated)]/40 px-5 py-3 flex flex-wrap gap-5 text-xs">
          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-cyan-500" /> Map: <strong>{match.mapName || "TBD"}</strong></span>
          <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-amber-500" /> Scheduled: <strong>{match.scheduledAt ? new Date(match.scheduledAt).toLocaleString() : "Unscheduled"}</strong></span>
          {match.deadlineAt && (
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-rose-500" /> Deadline: <strong>{new Date(match.deadlineAt).toLocaleString()}</strong></span>
          )}
          <span className="font-mono text-[var(--arena-muted)] ml-auto">ID: {match._id}</span>
        </div>
      </div>

      {/* Best-of Series Tracker */}
      {seriesMatches.length > 1 && (
        <div className="arena-card p-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-display-caps font-bold text-amber-500 mr-2">Series Games:</span>
          {seriesMatches.map((sm) => (
            <Link
              key={sm._id}
              href={`/tournaments/${id}/matches/${sm._id}`}
              className={`rounded-lg border px-3 py-1.5 font-mono font-bold ${
                sm._id === match._id ? "border-amber-500 bg-amber-500/15 text-amber-500" : "border-[var(--arena-border)] bg-[var(--arena-elevated)]"
              }`}
            >
              G{sm.seriesIndex} • {sm.reportedWinnerSide ? `Win ${sm.reportedWinnerSide}` : sm.status}
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Evidence, Submission & Reviewer Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Submitted Proof Card */}
          <div className="arena-card p-5 space-y-4">
            <h3 className="font-display-caps text-base font-bold">Match Evidence & Verification Status</h3>
            {match.proofUrl ? (
              <div className="space-y-3">
                <a href={match.proofUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-[var(--arena-border)] bg-black/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={match.proofUrl} alt="Submitted match proof" className="max-h-96 w-full object-contain" />
                </a>
                <div className="grid gap-2 sm:grid-cols-3 text-xs bg-[var(--arena-elevated)] rounded-lg p-3 font-mono">
                  <div>Reported Winner: <strong className="text-amber-500">Side {match.reportedWinnerSide}</strong></div>
                  <div>Submitted By: <strong>{match.submittedBy || "—"}</strong></div>
                  <div>Reviewed By: <strong>{match.reviewedBy || "Pending"}</strong></div>
                </div>
                {match.reviewNote && (
                  <div className="rounded-lg border border-[var(--arena-border)] p-3 text-xs">
                    <strong>Reviewer Note:</strong> {match.reviewNote}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[var(--arena-muted)]">
                No result proof submitted yet. Coordinate with your opponent, play on <strong>{match.mapName || "the assigned map"}</strong>, and submit your screenshot below (or via <code>/match submit</code> on Discord).
              </p>
            )}
          </div>

          {/* Participant Proof Submission Form */}
          {canSubmit && (
            <div className="arena-card p-5 space-y-4 border-amber-500/40">
              <h3 className="font-display-caps text-base font-bold text-amber-500">Submit Match Result & Proof</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Reported Winner</label>
                  <select className="arena-input mt-1" value={winnerSide} onChange={(e) => setWinnerSide(e.target.value as "A" | "B" | "DRAW")}>
                    <option value="A">Side A — {sideAName}</option>
                    <option value="B">Side B — {sideBName}</option>
                    {tournament.resultPolicy?.allowDraws && <option value="DRAW">Draw</option>}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Upload Screenshot Proof</label>
                  <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--arena-border)] bg-[var(--arena-bg)] px-3 py-2 text-xs font-semibold hover:border-amber-500">
                    <Upload className="h-4 w-4 text-amber-500" />
                    <span>{proofUrl.startsWith("data:") ? "Image Ready" : "Choose Match Screenshot"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleProofFile} />
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Or Paste Proof Image URL</label>
                  <input
                    className="arena-input mt-1"
                    placeholder="https://cdn.discordapp.com/.../result.png"
                    value={proofUrl.startsWith("data:") ? "" : proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                  />
                </div>
              </div>
              <button type="button" disabled={busy} onClick={() => runAction("submit", { winnerSide, proofUrl })} className="arena-btn-primary">
                Submit Result for Review
              </button>
            </div>
          )}

          {/* Participant Appeal */}
          {perms.isParticipant && ["approved", "rejected"].includes(match.status) && (
            <div className="arena-card p-4 flex items-center justify-between gap-3">
              <div className="text-xs text-[var(--arena-muted)]">Disagree with this decision? Open a formal dispute for head-manager review.</div>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt("Explain your appeal / dispute reason:");
                  if (reason) runAction("appeal", { reason });
                }}
                className="arena-btn-danger text-xs shrink-0"
              >
                <Flag className="h-3.5 w-3.5" /> Appeal Result
              </button>
            </div>
          )}

          {/* Reviewer & Manager Command Panel */}
          {(perms.canReview || perms.canManage || perms.isBotAdmin) && (
            <div className="arena-card p-5 space-y-4 border-cyan-500/40">
              <h3 className="font-display-caps text-base font-bold text-cyan-500 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> Referee & Manager Controls
              </h3>
              <input
                className="arena-input"
                placeholder="Review note / mandatory reason for reject, dispute, forfeit, or reopen..."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />

              <div className="flex flex-wrap gap-2">
                {perms.canReview && match.status === "pending_review" && (
                  <>
                    <button type="button" disabled={busy} onClick={() => runAction("approve")} className="arena-btn-primary text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> Approve Result</button>
                    <button type="button" disabled={busy} onClick={() => runAction("reject")} className="arena-btn-danger text-xs"><XCircle className="h-3.5 w-3.5" /> Reject</button>
                    <button type="button" disabled={busy} onClick={() => runAction("request_proof")} className="arena-btn-secondary text-xs">Request New Proof</button>
                    <button type="button" disabled={busy} onClick={() => runAction("dispute")} className="arena-btn-secondary text-xs"><AlertTriangle className="h-3.5 w-3.5" /> Mark Disputed</button>
                  </>
                )}

                {perms.canReview && match.status === "disputed" && (
                  <>
                    <button type="button" disabled={busy} onClick={() => runAction("resolve_dispute", { decision: "A" })} className="arena-btn-primary text-xs">Resolve → Award Side A</button>
                    <button type="button" disabled={busy} onClick={() => runAction("resolve_dispute", { decision: "B" })} className="arena-btn-primary text-xs">Resolve → Award Side B</button>
                    <button type="button" disabled={busy} onClick={() => runAction("resolve_dispute", { decision: "reject" })} className="arena-btn-danger text-xs">Resolve → Reject</button>
                  </>
                )}

                {perms.canManage && !["approved", "forfeited", "cancelled"].includes(match.status) && (
                  <>
                    <button type="button" disabled={busy} onClick={() => runAction("forfeit", { winnerSide: "A" })} className="arena-btn-secondary text-xs">Forfeit → Side A Wins</button>
                    <button type="button" disabled={busy} onClick={() => runAction("forfeit", { winnerSide: "B" })} className="arena-btn-secondary text-xs">Forfeit → Side B Wins</button>
                    <button type="button" disabled={busy} onClick={() => runAction("cancel")} className="arena-btn-danger text-xs">Cancel Match</button>
                  </>
                )}

                {perms.canManage && ["rejected", "disputed", "cancelled", "approved"].includes(match.status) && (
                  <button type="button" disabled={busy} onClick={() => runAction("reopen")} className="arena-btn-secondary text-xs"><RotateCcw className="h-3.5 w-3.5" /> Reopen Match</button>
                )}

                {perms.isBotAdmin && (
                  <>
                    <button type="button" disabled={busy} onClick={() => runAction("override", { winnerSide: "A" })} className="arena-btn-danger text-xs">Admin Override → Side A</button>
                    <button type="button" disabled={busy} onClick={() => runAction("override", { winnerSide: "B" })} className="arena-btn-danger text-xs">Admin Override → Side B</button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Reschedule/Edit & Audit History Timeline */}
        <div className="space-y-6">
          {perms.canManage && !["approved", "forfeited", "cancelled"].includes(match.status) && (
            <form onSubmit={saveMatchMeta} className="arena-card p-5 space-y-3">
              <h4 className="font-display-caps text-sm font-bold">Schedule, Map & Status</h4>
              <div>
                <label className="text-[11px] font-bold uppercase text-[var(--arena-muted)]">Map</label>
                <input className="arena-input mt-1" value={editMap} onChange={(e) => setEditMap(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-[var(--arena-muted)]">Scheduled Date/Time</label>
                <input type="datetime-local" className="arena-input mt-1" value={editSched} onChange={(e) => setEditSched(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-[var(--arena-muted)]">Status</label>
                <select className="arena-input mt-1" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                  <option value="scheduled">Scheduled</option>
                  <option value="ready">Ready to Play</option>
                  <option value="in_progress">In Progress</option>
                  <option value="pending_proof">Pending Proof</option>
                  <option value="postponed">Postponed</option>
                </select>
              </div>
              <button type="submit" disabled={busy} className="arena-btn-secondary w-full text-xs">Update Match Post</button>
            </form>
          )}

          <div className="arena-card p-5 space-y-3">
            <h4 className="font-display-caps text-sm font-bold flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-amber-500" /> Match Audit Timeline
            </h4>
            {history.length === 0 ? (
              <p className="text-xs text-[var(--arena-muted)]">No audit events logged yet.</p>
            ) : (
              <div className="space-y-2.5">
                {history.map((h) => (
                  <div key={h._id} className="rounded-lg bg-[var(--arena-elevated)] p-2.5 text-xs">
                    <div className="font-bold text-amber-500 font-mono">{h.action}</div>
                    <div className="text-[11px] text-[var(--arena-muted)] mt-0.5">
                      Actor: {h.actorId} • {new Date(h.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

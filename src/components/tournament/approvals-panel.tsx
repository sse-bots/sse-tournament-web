"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, AlertTriangle, ExternalLink, ShieldAlert, SlidersHorizontal, Image as ImageIcon } from "lucide-react";
import { TournamentDTO, RegistrationDTO, MatchDTO } from "@/lib/types";
import { MatchStatusBadge } from "@/components/ui/badges";
import { useToast } from "@/components/ui/toast";

interface Props {
  tournament: TournamentDTO;
  registrations: RegistrationDTO[];
  matches: MatchDTO[];
  canManage: boolean;
  canReview: boolean;
  suspendedByParticipation: boolean;
  onRefresh: () => Promise<void>;
}

export function ApprovalsPanel({ tournament, registrations, matches, canManage, canReview, suspendedByParticipation, onRefresh }: Props) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  const pendingPower = registrations.filter((r) => r.status === "registered" && r.squadPowerStatus === "pending");
  const pendingMatches = matches.filter((m) => m.status === "pending_review" || m.status === "disputed");

  async function reviewPower(action: "approve_power" | "reject_power" | "adjust_power", r: RegistrationDTO) {
    let payload: Record<string, unknown> = { action, userId: r.userId };
    if (action === "reject_power") {
      const note = window.prompt("Rejection note:");
      if (note === null) return;
      payload.note = note;
    } else if (action === "adjust_power") {
      const val = window.prompt("Corrected verified average Squad Power:", String(r.claimedSquadPower));
      const reason = val ? window.prompt("Mandatory audit reason:") : null;
      if (!val || !reason) return;
      payload = { action, userId: r.userId, verifiedAverage: Number(val), reason };
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament._id}/registrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Review failed");
      push("Squad-power submission updated.", "success");
      await onRefresh();
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function quickMatchAction(m: MatchDTO, action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament._id}/matches/${m._id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Match action failed");
      push(`Match #${m.matchNumber} updated (${action}).`, "success");
      await onRefresh();
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {suspendedByParticipation && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3 text-sm">
          <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-500">Conflict-of-Interest Protection Active</div>
            <p className="text-xs text-[var(--arena-muted)] mt-0.5">
              Registered participants cannot approve squad power or review match results in the same tournament.
            </p>
          </div>
        </div>
      )}

      <div className="arena-card p-5 space-y-4">
        <h3 className="font-display-caps text-base font-bold flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-cyan-500" /> Squad-Power Verification Queue ({pendingPower.length})
        </h3>
        {pendingPower.length === 0 ? (
          <p className="text-xs text-[var(--arena-muted)]">All squad-power proofs have been reviewed.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pendingPower.map((r) => (
              <div key={r._id} className="rounded-xl border border-[var(--arena-border)] bg-[var(--arena-elevated)] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold">{r.displayName || r.userId}</div>
                    <div className="font-mono text-xs text-[var(--arena-muted)]">IGN: {r.inGameId || "—"} • [{r.powerValues.join(", ")}]</div>
                  </div>
                  <div className="text-right font-mono text-lg font-bold text-amber-500">{r.claimedSquadPower.toFixed(1)} SP</div>
                </div>
                {r.squadPowerProofUrl && (
                  <a href={r.squadPowerProofUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-[var(--arena-border)] bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.squadPowerProofUrl} alt="Squad power proof" className="max-h-48 w-full object-contain" />
                  </a>
                )}
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => reviewPower("approve_power", r)} className="arena-btn-primary text-xs py-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</button>
                    <button type="button" disabled={busy} onClick={() => reviewPower("adjust_power", r)} className="arena-btn-secondary text-xs py-1.5">Adjust SP</button>
                    <button type="button" disabled={busy} onClick={() => reviewPower("reject_power", r)} className="arena-btn-danger text-xs py-1.5"><XCircle className="h-3.5 w-3.5" /> Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="arena-card p-5 space-y-4">
        <h3 className="font-display-caps text-base font-bold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" /> Match Result Reviews & Disputes ({pendingMatches.length})
        </h3>
        {pendingMatches.length === 0 ? (
          <p className="text-xs text-[var(--arena-muted)]">No pending match submissions or open disputes.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pendingMatches.map((m) => (
              <div key={m._id} className="rounded-xl border border-[var(--arena-border)] bg-[var(--arena-elevated)] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-display-caps font-bold">Match #{String(m.matchNumber).padStart(3, "0")} · Round {m.roundNumber}</div>
                  <MatchStatusBadge status={m.status} />
                </div>
                <div className="text-xs space-y-1">
                  <div><strong>Side A:</strong> {m.sideATeamName || m.sideAUserIds.join(", ")}</div>
                  <div><strong>Side B:</strong> {m.sideBTeamName || m.sideBUserIds.join(", ")}</div>
                  <div className="text-amber-500 font-bold">Reported Winner: Side {m.reportedWinnerSide || "—"}</div>
                  {m.appealReason && <div className="text-rose-400">Appeal/Dispute: {m.appealReason}</div>}
                </div>
                {m.proofUrl ? (
                  <a href={m.proofUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-[var(--arena-border)] bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.proofUrl} alt="Match proof" className="max-h-48 w-full object-contain" />
                  </a>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-[var(--arena-muted)]"><ImageIcon className="h-4 w-4" /> No screenshot attached</div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {canReview && m.status === "pending_review" && (
                    <>
                      <button type="button" disabled={busy} onClick={() => quickMatchAction(m, "approve", { note: "Approved via Web Arena" })} className="arena-btn-primary text-xs py-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</button>
                      <button type="button" disabled={busy} onClick={() => { const r = window.prompt("Rejection reason:"); if (r) quickMatchAction(m, "reject", { note: r }); }} className="arena-btn-danger text-xs py-1.5"><XCircle className="h-3.5 w-3.5" /> Reject</button>
                      <button type="button" disabled={busy} onClick={() => { const n = window.prompt("Dispute note:"); if (n) quickMatchAction(m, "dispute", { note: n }); }} className="arena-btn-secondary text-xs py-1.5">Dispute</button>
                    </>
                  )}
                  <Link href={`/tournaments/${tournament._id}/matches/${m._id}`} className="arena-btn-secondary text-xs py-1.5 ml-auto">
                    Match Post <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

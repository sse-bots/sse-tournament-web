"use client";

import Link from "next/link";

import { useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Image as ImageIcon,
  Layers,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
  XCircle,
  Lock,
} from "lucide-react";
import { useTournamentDetail } from "@/components/TournamentDetailContext";
import type { RegistrationRow } from "@/lib/tournament-types";

type PlayerFilter = "all" | "pending" | "approved" | "rejected" | "disqualified";

export default function TournamentPlayersPage() {
  const { data, refresh, showToast, setError } = useTournamentDetail();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PlayerFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<RegistrationRow | null>(null);

  const [modal, setModal] = useState<{
    reg: RegistrationRow;
    mode: "adjust_power" | "move_bracket" | "disqualify" | "remove";
  } | null>(null);
  const [adjustValue, setAdjustValue] = useState("");
  const [targetBracketId, setTargetBracketId] = useState("");
  const [reason, setReason] = useState("");

  const t = data?.tournament;
  const access = data?.access;
  const regs = useMemo(() => data?.registrations || [], [data?.registrations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return regs.filter((r) => {
      if (filter === "pending" && (r.status !== "registered" || r.squadPowerStatus !== "pending")) return false;
      if (filter === "approved" && (r.status !== "registered" || r.squadPowerStatus !== "approved")) return false;
      if (filter === "rejected" && (r.status !== "registered" || r.squadPowerStatus !== "rejected")) return false;
      if (filter === "disqualified" && r.status !== "disqualified") return false;
      if (!q) return true;
      return (
        r.userId.includes(q) ||
        r.inGameId.toLowerCase().includes(q) ||
        (r.discordDisplayName || "").toLowerCase().includes(q) ||
        (r.discordUsername || "").toLowerCase().includes(q) ||
        (r.bracketName || "").toLowerCase().includes(q) ||
        (r.teamName || "").toLowerCase().includes(q)
      );
    });
  }, [regs, search, filter]);

  if (!data || !t || !access) return null;

  const isStaff = access.canManageTournament || access.canAssignModerators;
  if (!isStaff) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-amber-500/40 bg-slate-900/75 p-8 text-center">
        <Lock className="mx-auto mb-3 h-9 w-9 text-amber-400" />
        <h2 className="text-base font-extrabold text-white">
          Staff Only — Players & Squad-Power Queue
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
  const pendingCount = regs.filter(
    (r) => r.status === "registered" && r.squadPowerStatus === "pending"
  ).length;

  async function patchRegistration(
    registrationId: string,
    payload: Record<string, unknown>,
    successMsg: string
  ) {
    setBusyId(registrationId);
    setError(null);
    try {
      const res = await fetch(
        `/api/tournaments/${encodeURIComponent(t!.id)}/registrations`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationId, ...payload }),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Player update failed.");
        return;
      }
      setModal(null);
      showToast(successMsg);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player IGN, Discord name, user ID, bracket, or team..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: "all", label: `All (${regs.length})` },
              { id: "pending", label: `Pending SP (${pendingCount})` },
              { id: "approved", label: "Approved" },
              { id: "rejected", label: "Rejected" },
              { id: "disqualified", label: "Disqualified" },
            ] as Array<{ id: PlayerFilter; label: string }>
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
      </div>

      {/* Players List */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-slate-500" />
          <h3 className="text-sm font-bold text-white">No Players Found</h3>
          <p className="mt-1 text-xs text-slate-400">
            Players register in Discord using{" "}
            <code className="text-indigo-400">/register</code>.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const isBusy = busyId === r.id;
            const displayName =
              r.inGameId ||
              r.discordDisplayName ||
              r.discordUsername ||
              `Player #${r.userId.slice(-4)}`;

            return (
              <div
                key={r.id}
                className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5"
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-white">
                        {displayName}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                          r.status === "disqualified"
                            ? "bg-rose-500/20 text-rose-300"
                            : r.squadPowerStatus === "approved"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : r.squadPowerStatus === "rejected"
                                ? "bg-rose-500/15 text-rose-300"
                                : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {r.status !== "registered"
                          ? r.status
                          : `SP ${r.squadPowerStatus}`}
                      </span>
                      {r.bracketName && (
                        <span className="rounded-lg bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                          {r.bracketName}
                          {r.bracketOverride ? " (override)" : ""}
                        </span>
                      )}
                      {r.teamName && (
                        <span className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                          Team: {r.teamName}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                      <span className="font-mono">
                        {r.discordUsername ? `@${r.discordUsername} · ` : ""}
                        ID: {r.userId}
                      </span>
                      <span>
                        Claimed SP:{" "}
                        <strong className="text-white">
                          {r.claimedSquadPower ?? "—"}
                        </strong>
                      </span>
                      <span>
                        Verified SP:{" "}
                        <strong className="text-emerald-400">
                          {r.verifiedSquadPower ?? "Pending"}
                        </strong>
                      </span>
                      <span>
                        Record:{" "}
                        <strong className="text-white">
                          {r.wins}W/{r.losses}L ({r.points} pts)
                        </strong>
                      </span>
                      {r.squadPowerProofUrl && (
                        <button
                          type="button"
                          onClick={() => setProofPreview(r)}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-2 py-0.5 font-bold text-indigo-300 hover:bg-indigo-500/20"
                        >
                          <ImageIcon className="h-3 w-3" />
                          View Hangar Proof
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Staff Actions */}
                  {canManage && r.status === "registered" && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {r.squadPowerStatus !== "approved" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            patchRegistration(
                              r.id,
                              { action: "approve_power" },
                              `Approved Squad Power for ${displayName}! DM sent via Bot.`
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve SP
                        </button>
                      )}
                      {r.squadPowerStatus === "pending" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            patchRegistration(
                              r.id,
                              { action: "reject_power", reason: "Proof unclear" },
                              `Rejected Squad Power proof for ${displayName}.`
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-300"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setAdjustValue(
                            String(
                              r.verifiedSquadPower ?? r.claimedSquadPower ?? 0
                            )
                          );
                          setReason("");
                          setModal({ reg: r, mode: "adjust_power" });
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:border-indigo-500"
                      >
                        <SlidersHorizontal className="h-3 w-3 text-indigo-400" />
                        Adjust SP
                      </button>

                      {t.bracketsEnabled && t.brackets.length > 0 && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setTargetBracketId(
                              r.bracketId || t.brackets[0]?.id || ""
                            );
                            setReason("");
                            setModal({ reg: r, mode: "move_bracket" });
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:border-amber-500"
                        >
                          <Layers className="h-3 w-3 text-amber-400" />
                          Move Tier
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setReason("");
                          setModal({ reg: r, mode: "disqualify" });
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-500/35 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-bold text-rose-300"
                        title="Disqualify player"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        DQ
                      </button>

                      {!t.settingsLocked && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setReason("");
                            setModal({ reg: r, mode: "remove" });
                          }}
                          className="rounded-xl border border-slate-700 bg-slate-800 p-1.5 text-slate-400 hover:text-rose-300"
                          title="Remove registration"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Proof Lightbox */}
      {proofPreview?.squadPowerProofUrl && (
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
                  Squad Power Proof — {proofPreview.inGameId || proofPreview.userId}
                </div>
                <div className="text-[11px] text-slate-400">
                  Claimed Values: {proofPreview.powerValues.join(", ") || "—"} ·
                  Average: {proofPreview.claimedSquadPower ?? "—"} SP
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProofPreview(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto bg-slate-950 p-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proofPreview.squadPowerProofUrl}
                alt="Squad power proof"
                className="mx-auto max-h-[65vh] rounded-2xl object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Adjust / Move / DQ / Remove Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-3xl border border-slate-700 bg-[#0b1120] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-white">
                {modal.mode === "adjust_power"
                  ? "Adjust Verified Squad Power"
                  : modal.mode === "move_bracket"
                    ? "Move Player to Bracket"
                    : modal.mode === "disqualify"
                      ? "Disqualify Participant"
                      : "Remove Registration"}
              </h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modal.mode === "adjust_power" && (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-200">
                  Verified Average SP
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={adjustValue}
                  onChange={(e) => setAdjustValue(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>
            )}

            {modal.mode === "move_bracket" && (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-200">
                  Destination Bracket
                </label>
                <select
                  value={targetBracketId}
                  onChange={(e) => setTargetBracketId(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  {t.brackets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.minPower} – {b.maxPower ?? "∞"} SP)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-200">
                Audit Reason
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason logged in audit trail..."
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === modal.reg.id}
                onClick={() => {
                  if (modal.mode === "adjust_power") {
                    patchRegistration(
                      modal.reg.id,
                      {
                        action: "adjust_power",
                        verifiedAverage: Number(adjustValue),
                        reason: reason.trim(),
                      },
                      "Verified Squad Power updated!"
                    );
                  } else if (modal.mode === "move_bracket") {
                    patchRegistration(
                      modal.reg.id,
                      {
                        action: "move_bracket",
                        bracketId: targetBracketId,
                        reason: reason.trim(),
                      },
                      "Player moved to selected bracket!"
                    );
                  } else if (modal.mode === "disqualify") {
                    patchRegistration(
                      modal.reg.id,
                      { action: "disqualify", reason: reason.trim() },
                      "Participant disqualified."
                    );
                  } else {
                    patchRegistration(
                      modal.reg.id,
                      { action: "remove", reason: reason.trim() },
                      "Registration removed."
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

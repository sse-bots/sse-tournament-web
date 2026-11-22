"use client";

import React, { useMemo, useState } from "react";
import { UserPlus, Upload, CheckCircle2, Clock, XCircle, LogOut, Ban, Trash2, ArrowRightLeft } from "lucide-react";
import { TournamentDTO, RegistrationDTO } from "@/lib/types";
import { useToast } from "@/components/ui/toast";

interface Props {
  tournament: TournamentDTO;
  registrations: RegistrationDTO[];
  discordId: string | null;
  canManage: boolean;
  onRefresh: () => Promise<void>;
}

export function RegistrationPanel({ tournament, registrations, discordId, canManage, onRefresh }: Props) {
  const { push } = useToast();
  const myReg = registrations.find((r) => r.userId === discordId && r.status === "registered") || null;

  const [inGameId, setInGameId] = useState(myReg?.inGameId || "");
  const [spValues, setSpValues] = useState(myReg ? myReg.powerValues.join(", ") : "");
  const [proofUrl, setProofUrl] = useState(myReg?.squadPowerProofUrl || "");
  const [busy, setBusy] = useState(false);

  const liveCalc = useMemo(() => {
    const nums = spValues.split(",").map((s) => s.trim()).filter(Boolean).map(Number);
    if (!nums.length || nums.some((n) => Number.isNaN(n) || n < 0)) return null;
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    const matched = tournament.bracketsEnabled
      ? tournament.brackets.find((b) => avg >= b.minPower && (b.maxPower === null || avg <= b.maxPower)) || null
      : null;
    return { avg, matched };
  }, [spValues, tournament.bracketsEnabled, tournament.brackets]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return push("Select an image file (PNG, JPG, WEBP).", "error");
    if (file.size > 2.5 * 1024 * 1024) return push("Keep image under 2.5 MB or paste an HTTPS URL.", "error");
    const reader = new FileReader();
    reader.onload = () => setProofUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function submitRegistration(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament._id}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", inGameId, squadPowerValues: spValues, proofUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      push("Registration submitted! Proof queued for manager verification.", "success");
      await onRefresh();
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!window.confirm("Withdraw from this tournament?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament._id}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unregister" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Withdraw failed");
      push("Withdrew from tournament.", "info");
      await onRefresh();
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function managerPlayerAction(action: "remove_player" | "disqualify_player", userId: string) {
    const reason = window.prompt(`Mandatory audit reason for ${action.replace("_", " ")}:`);
    if (!reason) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament._id}/registrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      push("Participant record updated.", "info");
      await onRefresh();
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function moveBracket(userId: string) {
    if (!tournament.brackets.length) return;
    const names = tournament.brackets.map((b, i) => `${i + 1}. ${b.name}`).join("\n");
    const target = tournament.brackets[Number(window.prompt(`Select bracket number:\n${names}`)) - 1];
    if (!target) return;
    const reason = window.prompt("Audit reason for manual bracket override:");
    if (!reason) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament._id}/brackets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move_player", userId, bracketId: target._id, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Move failed");
      push(`Moved player to ${target.name}.`, "success");
      await onRefresh();
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const bracketName = (bid: string | null) =>
    tournament.brackets.find((b) => b._id === bid)?.name || (tournament.bracketsEnabled ? "Unassigned" : "Open");

  const activeRegs = registrations.filter((r) => r.status === "registered");

  return (
    <div className="space-y-6">
      <div className="arena-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display-caps text-lg font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-amber-500" />
              {myReg ? "Your Tournament Entry" : "Register for Tournament"}
            </h3>
            <p className="text-xs text-[var(--arena-muted)]">
              Enter your In-Game ID, comma-separated Squad Power / XP values, and attach screenshot proof.
            </p>
          </div>
          {myReg && ["registration", "registration_closed"].includes(tournament.status) && (
            <button type="button" onClick={withdraw} disabled={busy} className="arena-btn-danger text-xs">
              <LogOut className="h-3.5 w-3.5" /> Withdraw Entry
            </button>
          )}
        </div>

        {myReg && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 flex flex-wrap items-center justify-between gap-4 text-sm">
            <div>
              <div className="font-bold">
                IGN: <span className="font-mono text-amber-500">{myReg.inGameId || "Not set"}</span> • Bracket:{" "}
                <span className="text-cyan-400">{bracketName(myReg.bracketId)}</span>
              </div>
              <div className="text-xs text-[var(--arena-muted)] mt-0.5 font-mono">
                Claimed Avg SP: {myReg.claimedSquadPower.toLocaleString()} • Verified SP:{" "}
                {myReg.verifiedSquadPower !== null ? myReg.verifiedSquadPower.toLocaleString() : "Pending"}
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase ${
              myReg.squadPowerStatus === "approved" ? "bg-emerald-500/20 text-emerald-400"
                : myReg.squadPowerStatus === "rejected" ? "bg-red-500/20 text-red-400"
                  : "bg-amber-500/20 text-amber-400"
            }`}>
              {myReg.squadPowerStatus === "approved" ? <CheckCircle2 className="h-3.5 w-3.5" /> : myReg.squadPowerStatus === "rejected" ? <XCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              Proof {myReg.squadPowerStatus}
            </span>
          </div>
        )}

        {tournament.status === "registration" ? (
          <form onSubmit={submitRegistration} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">In-Game ID / Tag</label>
              <input className="arena-input mt-1 font-mono" placeholder="e.g. 58291043" value={inGameId} onChange={(e) => setInGameId(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Squad Power / XP Values (comma-sep)</label>
              <input className="arena-input mt-1 font-mono" placeholder="e.g. 3200, 3450, 3100" value={spValues} onChange={(e) => setSpValues(e.target.value)} required />
              {liveCalc && (
                <div className="mt-1.5 text-xs font-mono">
                  Avg: <strong className="text-amber-500">{liveCalc.avg.toFixed(1)}</strong>
                  {tournament.bracketsEnabled && (
                    <span className="ml-2">
                      → {liveCalc.matched ? <span className="text-emerald-500 font-bold">{liveCalc.matched.name}</span> : <span className="text-red-500 font-bold">No matching bracket!</span>}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Screenshot Proof URL</label>
                <input
                  className="arena-input mt-1"
                  placeholder="https://cdn.discordapp.com/.../hangar.png"
                  value={proofUrl.startsWith("data:") ? "(Uploaded Image Attached)" : proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  required={!proofUrl}
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Or Upload Image</label>
                <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--arena-border)] bg-[var(--arena-bg)] px-3 py-2 text-xs font-semibold hover:border-amber-500">
                  <Upload className="h-4 w-4 text-amber-500" />
                  <span>Choose Hangar / Profile Screenshot</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
              </div>
            </div>
            <div className="md:col-span-2 flex items-center justify-between gap-3">
              <p className="text-[11px] text-[var(--arena-muted)]">Registering suspends manager privileges for this tournament.</p>
              <button type="submit" disabled={busy || !discordId} className="arena-btn-primary">
                <UserPlus className="h-4 w-4" /> {myReg ? "Update Registration" : "Submit Registration"}
              </button>
            </div>
          </form>
        ) : (
          <div className="rounded-lg bg-[var(--arena-elevated)] p-3 text-xs text-[var(--arena-muted)]">
            Registration is currently <strong>{tournament.status.replace(/_/g, " ")}</strong>.
          </div>
        )}
      </div>

      <div className="arena-card overflow-hidden">
        <div className="border-b border-[var(--arena-border)] px-5 py-3.5">
          <h4 className="font-display-caps text-base font-bold">Registered Competitors ({activeRegs.length})</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--arena-elevated)] text-[11px] uppercase tracking-wider text-[var(--arena-muted)]">
              <tr>
                <th className="px-4 py-3">Player / IGN</th>
                <th className="px-4 py-3">Bracket</th>
                <th className="px-4 py-3">Avg Squad Power</th>
                <th className="px-4 py-3">Proof</th>
                <th className="px-4 py-3">Record</th>
                {canManage && <th className="px-4 py-3 text-right">Manager</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--arena-border)]">
              {registrations.length === 0 ? (
                <tr><td colSpan={canManage ? 6 : 5} className="px-4 py-8 text-center text-[var(--arena-muted)]">No players registered yet.</td></tr>
              ) : registrations.map((r) => (
                <tr key={r._id} className="hover:bg-[var(--arena-elevated)]/40">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{r.displayName || `User ${r.userId}`}</div>
                    <div className="font-mono text-[11px] text-[var(--arena-muted)]">ID: {r.userId} {r.inGameId ? `• IGN: ${r.inGameId}` : ""}</div>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-cyan-500">{bracketName(r.bracketId)}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {r.verifiedSquadPower !== null ? <span className="font-bold text-emerald-500">{r.verifiedSquadPower.toLocaleString()}</span> : <span className="text-[var(--arena-muted)]">{r.claimedSquadPower.toLocaleString()} (claimed)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                      r.status !== "registered" ? "bg-zinc-500/20 text-zinc-400"
                        : r.squadPowerStatus === "approved" ? "bg-emerald-500/15 text-emerald-500"
                          : r.squadPowerStatus === "rejected" ? "bg-red-500/15 text-red-500"
                            : "bg-amber-500/15 text-amber-500"
                    }`}>{r.status !== "registered" ? r.status : r.squadPowerStatus}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.wins}W-{r.losses}L · {r.points} pts</td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      {r.status === "registered" && (
                        <div className="inline-flex items-center gap-1">
                          {tournament.bracketsEnabled && !tournament.settingsLocked && (
                            <button type="button" onClick={() => moveBracket(r.userId)} className="p-1.5 rounded-md hover:bg-cyan-500/15 text-cyan-500" title="Move Bracket"><ArrowRightLeft className="h-3.5 w-3.5" /></button>
                          )}
                          {!tournament.settingsLocked && (
                            <button type="button" onClick={() => managerPlayerAction("remove_player", r.userId)} className="p-1.5 rounded-md hover:bg-amber-500/15 text-amber-500" title="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
                          )}
                          <button type="button" onClick={() => managerPlayerAction("disqualify_player", r.userId)} className="p-1.5 rounded-md hover:bg-red-500/15 text-red-500" title="Disqualify"><Ban className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

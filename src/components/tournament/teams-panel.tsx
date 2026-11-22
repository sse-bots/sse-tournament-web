"use client";

import React, { useState } from "react";
import { Users, Plus, Crown, UserPlus, LogIn, LogOut, Repeat, Ban, Edit3, Trash2, CheckCircle2, MailCheck } from "lucide-react";
import { TournamentDTO, TeamDTO, RegistrationDTO } from "@/lib/types";
import { useToast } from "@/components/ui/toast";

interface Props {
  tournament: TournamentDTO;
  teams: TeamDTO[];
  registrations: RegistrationDTO[];
  discordId: string | null;
  canManage: boolean;
  onRefresh: () => Promise<void>;
}

export function TeamsPanel({ tournament, teams, registrations, discordId, canManage, onRefresh }: Props) {
  const { push } = useToast();
  const [teamName, setTeamName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const regMap = new Map(registrations.map((r) => [r.userId, r]));

  async function callTeamApi(payload: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament._id}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Team action failed");
      push(successMsg, "success");
      await onRefresh();
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    await callTeamApi({ action: "create", name: teamName, logoUrl }, `Created team "${teamName}"!`);
    setTeamName("");
    setLogoUrl("");
  }

  if (tournament.mode !== "team") {
    return (
      <div className="arena-card p-6 text-center text-sm text-[var(--arena-muted)]">
        This tournament is configured as <strong>Individual Mode</strong>.
      </div>
    );
  }

  const activeTeams = teams.filter((t) => t.status === "active");

  return (
    <div className="space-y-6">
      {tournament.status === "registration" && !tournament.teamsLocked && (
        <form onSubmit={createTeam} className="arena-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display-caps text-base font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-500" />
                Create a Squad ({tournament.teamSizeMin}–{tournament.teamSizeMax} Players)
              </h3>
              <p className="text-xs text-[var(--arena-muted)]">Register individually first, then create or join a team below.</p>
            </div>
            <span className="text-[11px] font-mono text-cyan-500 uppercase">Rule: {tournament.teamPowerRule} SP</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <input className="arena-input" placeholder="Team Name" value={teamName} onChange={(e) => setTeamName(e.target.value)} required />
            <input className="arena-input" placeholder="HTTPS Logo URL (optional)" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            <button type="submit" disabled={busy || !discordId} className="arena-btn-primary"><Plus className="h-4 w-4" /> Create Team</button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {activeTeams.length === 0 ? (
          <div className="arena-card md:col-span-2 p-8 text-center text-sm text-[var(--arena-muted)]">No active teams registered yet.</div>
        ) : activeTeams.map((tm) => {
          const isMember = Boolean(discordId && tm.memberIds.includes(discordId));
          const isCaptain = Boolean(discordId && tm.captainId === discordId);
          const isInvited = Boolean(discordId && (tm.invitedIds || []).includes(discordId));
          const verifiedCount = tm.memberIds.filter((uid) => regMap.get(uid)?.squadPowerStatus === "approved").length;
          const rosterReady = tm.memberIds.length >= (tournament.allowIncompleteTeams ? 1 : tournament.teamSizeMin) && verifiedCount === tm.memberIds.length;

          return (
            <div key={tm._id} className="arena-card p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {tm.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={tm.logoUrl} alt={tm.name} className="h-11 w-11 rounded-xl object-cover border border-[var(--arena-border)]" />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 font-display-caps text-lg font-bold text-amber-500 border border-amber-500/30">
                        {tm.name.slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <h4 className="font-display-caps text-lg font-bold leading-tight">{tm.name}</h4>
                      <div className="text-xs text-[var(--arena-muted)] font-mono">{tm.memberIds.length}/{tournament.teamSizeMax} players • {verifiedCount} SP verified</div>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${rosterReady ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30" : "bg-amber-500/15 text-amber-500 border border-amber-500/30"}`}>
                    {rosterReady ? "Ready" : "Pending"}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {tm.memberIds.map((uid) => {
                    const r = regMap.get(uid);
                    return (
                      <div key={uid} className="flex items-center justify-between rounded-lg bg-[var(--arena-elevated)] px-3 py-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          {tm.captainId === uid && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                          <span className="font-semibold">{r?.inGameId || r?.displayName || uid}</span>
                          <span className="font-mono text-[10px] text-[var(--arena-muted)]">({uid})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {r?.squadPowerStatus === "approved" ? (
                            <span className="flex items-center gap-1 font-mono text-emerald-500"><CheckCircle2 className="h-3 w-3" /> {r.verifiedSquadPower}</span>
                          ) : (
                            <span className="text-amber-500 text-[10px] uppercase font-bold">SP Pending</span>
                          )}
                          {(isCaptain || canManage) && uid !== tm.captainId && (
                            <button type="button" disabled={busy} onClick={() => { const reason = window.prompt("Kick reason:") || "Roster change"; callTeamApi({ action: "kick", teamId: tm._id, targetUserId: uid, reason }, "Player removed."); }} className="text-red-500 hover:underline text-[10px]">Kick</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--arena-border)]">
                {!isMember && tournament.status === "registration" && !tournament.teamsLocked && (
                  isInvited ? (
                    <button type="button" disabled={busy} onClick={() => callTeamApi({ action: "accept", teamId: tm._id }, `Joined ${tm.name}!`)} className="arena-btn-primary text-xs py-1.5 px-3"><MailCheck className="h-3.5 w-3.5" /> Accept Invite</button>
                  ) : !tournament.teamInvitesOnly && tm.memberIds.length < tournament.teamSizeMax ? (
                    <button type="button" disabled={busy || !discordId} onClick={() => callTeamApi({ action: "join", teamId: tm._id }, `Joined ${tm.name}!`)} className="arena-btn-secondary text-xs py-1.5 px-3"><LogIn className="h-3.5 w-3.5" /> Join</button>
                  ) : null
                )}
                {isMember && !tournament.teamsLocked && (
                  <button type="button" disabled={busy} onClick={() => callTeamApi({ action: "leave", teamId: tm._id }, `Left ${tm.name}.`)} className="arena-btn-secondary text-xs py-1.5 px-3"><LogOut className="h-3.5 w-3.5" /> Leave</button>
                )}
                {isCaptain && !tournament.teamsLocked && (
                  <button type="button" disabled={busy} onClick={() => { const id = window.prompt("Registered player Discord ID to invite:"); if (id) callTeamApi({ action: "invite", teamId: tm._id, targetUserId: id }, "Invitation recorded!"); }} className="arena-btn-secondary text-xs py-1.5 px-3"><UserPlus className="h-3.5 w-3.5" /> Invite</button>
                )}
                {(isCaptain || canManage) && !tournament.teamsLocked && (
                  <>
                    <button type="button" disabled={busy} onClick={() => { const n = window.prompt("New team name:", tm.name); const l = window.prompt("HTTPS logo URL:", tm.logoUrl || ""); if (n !== null) callTeamApi({ action: "edit", teamId: tm._id, name: n, logoUrl: l || "" }, "Team updated."); }} className="arena-btn-secondary text-xs py-1.5 px-3"><Edit3 className="h-3.5 w-3.5" /> Edit</button>
                    <button type="button" disabled={busy} onClick={() => { const id = window.prompt("New captain Discord ID:"); if (id) callTeamApi({ action: "transfer_captain", teamId: tm._id, newCaptainId: id }, "Captaincy transferred."); }} className="arena-btn-secondary text-xs py-1.5 px-3"><Crown className="h-3.5 w-3.5" /> Captain</button>
                    <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Disband "${tm.name}"?`)) callTeamApi({ action: "delete", teamId: tm._id }, "Team disbanded."); }} className="arena-btn-danger text-xs py-1.5 px-3"><Trash2 className="h-3.5 w-3.5" /> Disband</button>
                  </>
                )}
                {canManage && (
                  <>
                    <button type="button" disabled={busy} onClick={() => { const o = window.prompt("Outgoing Discord ID:"); const i = window.prompt("Incoming registered Discord ID:"); const r = window.prompt("Substitution reason:"); if (o && i && r) callTeamApi({ action: "substitute", teamId: tm._id, outgoingId: o, incomingId: i, reason: r }, "Player substituted."); }} className="arena-btn-secondary text-xs py-1.5 px-3"><Repeat className="h-3.5 w-3.5" /> Substitute</button>
                    <button type="button" disabled={busy} onClick={() => { const r = window.prompt(`Disqualify "${tm.name}" reason:`); if (r) callTeamApi({ action: "disqualify", teamId: tm._id, reason: r }, "Team disqualified."); }} className="arena-btn-danger text-xs py-1.5 px-3"><Ban className="h-3.5 w-3.5" /> DQ</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

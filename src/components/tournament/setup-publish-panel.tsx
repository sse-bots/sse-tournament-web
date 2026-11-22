"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket, Lock, Plus, Trash2, Save, Play, Pause, CheckCircle2,
  XCircle, Archive, Copy, AlertTriangle, Sliders, Layers, Award, Shield,
} from "lucide-react";
import { TournamentDTO, SCORING_SYSTEMS, TEAM_POWER_RULES } from "@/lib/types";
import { useToast } from "@/components/ui/toast";

interface Props {
  tournament: TournamentDTO;
  canManage: boolean;
  onRefresh: () => Promise<void>;
}

export function SetupPublishPanel({ tournament, canManage, onRefresh }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const locked = tournament.settingsLocked || !["draft", "registration", "registration_closed"].includes(tournament.status);

  const [bName, setBName] = useState("");
  const [bMin, setBMin] = useState("1000");
  const [bMax, setBMax] = useState("4000");
  const [bOverlap, setBOverlap] = useState(false);

  const [name, setName] = useState(tournament.name);
  const [description, setDescription] = useState(tournament.description || "");
  const [bracketsEnabled, setBracketsEnabled] = useState(tournament.bracketsEnabled);
  const [scoring, setScoring] = useState(tournament.scoring);
  const [mapsText, setMapsText] = useState((tournament.maps || []).join(", "));
  const [startAt, setStartAt] = useState(tournament.schedule?.startAt ? tournament.schedule.startAt.slice(0, 16) : "");
  const [endAt, setEndAt] = useState(tournament.schedule?.endAt ? tournament.schedule.endAt.slice(0, 16) : "");
  const [deadlineHrs, setDeadlineHrs] = useState(String(tournament.schedule?.matchDeadlineHours ?? 48));
  const [durationMins, setDurationMins] = useState(String(tournament.schedule?.matchDurationMinutes ?? 60));
  const [proofRequired, setProofRequired] = useState(tournament.resultPolicy?.proofRequired ?? true);
  const [approvalRequired, setApprovalRequired] = useState(tournament.resultPolicy?.approvalRequired ?? true);
  const [allowDraws, setAllowDraws] = useState(tournament.resultPolicy?.allowDraws ?? false);
  const [seriesBestOf, setSeriesBestOf] = useState(String(tournament.seriesBestOf ?? 3));
  const [swissRounds, setSwissRounds] = useState(String(tournament.swissRounds ?? 0));
  const [tieBreakers, setTieBreakers] = useState((tournament.tieBreakers || ["wins", "head_to_head", "points"]).join(", "));
  const [winWeight, setWinWeight] = useState(String(tournament.winWeight ?? 3));
  const [powerWeight, setPowerWeight] = useState(String(tournament.powerWeight ?? 0));
  const [pointsWeight, setPointsWeight] = useState(String(tournament.pointsWeight ?? 1));

  const [teamMin, setTeamMin] = useState(String(tournament.teamSizeMin ?? 2));
  const [teamMax, setTeamMax] = useState(String(tournament.teamSizeMax ?? 5));
  const [teamPowerRule, setTeamPowerRule] = useState(tournament.teamPowerRule || "average");
  const [allowMultiTeams, setAllowMultiTeams] = useState(Boolean(tournament.allowMultipleTeams));
  const [allowIncomplete, setAllowIncomplete] = useState(Boolean(tournament.allowIncompleteTeams));
  const [invitesOnly, setInvitesOnly] = useState(Boolean(tournament.teamInvitesOnly));

  const [managerRoles, setManagerRoles] = useState((tournament.managerRoleIds || []).join(", "));
  const [reviewerRoles, setReviewerRoles] = useState((tournament.reviewerRoleIds || []).join(", "));
  const [headRoles, setHeadRoles] = useState((tournament.headManagerRoleIds || []).join(", "));
  const [announceCh, setAnnounceCh] = useState(tournament.announcementChannelId || "");
  const [prize1, setPrize1] = useState(tournament.prizeDescriptions?.first || "");
  const [prize2, setPrize2] = useState(tournament.prizeDescriptions?.second || "");
  const [prize3, setPrize3] = useState(tournament.prizeDescriptions?.third || "");
  const [awardRole1, setAwardRole1] = useState(tournament.awardRoleIds?.first || "");
  const [awardRole2, setAwardRole2] = useState(tournament.awardRoleIds?.second || "");
  const [awardRole3, setAwardRole3] = useState(tournament.awardRoleIds?.third || "");

  const [busy, setBusy] = useState(false);

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description, bracketsEnabled, scoring, maps: mapsText,
          schedule: {
            startAt: startAt ? new Date(startAt).toISOString() : "",
            endAt: endAt ? new Date(endAt).toISOString() : "",
            matchDeadlineHours: Number(deadlineHrs),
            matchDurationMinutes: Number(durationMins),
          },
          resultPolicy: { proofRequired, approvalRequired, allowDraws },
          seriesBestOf: Number(seriesBestOf), swissRounds: Number(swissRounds), tieBreakers,
          winWeight: Number(winWeight), powerWeight: Number(powerWeight), pointsWeight: Number(pointsWeight),
          teamSizeMin: Number(teamMin), teamSizeMax: Number(teamMax), teamPowerRule,
          allowMultipleTeams: allowMultiTeams, allowIncompleteTeams: allowIncomplete, teamInvitesOnly: invitesOnly,
          managerRoleIds: managerRoles, reviewerRoleIds: reviewerRoles, headManagerRoleIds: headRoles,
          announcementChannelId: announceCh,
          prizeDescriptions: { first: prize1, second: prize2, third: prize3 },
          awardRoleIds: { first: awardRole1, second: awardRole2, third: awardRole3 },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      push("Tournament settings saved.", "success");
      await onRefresh();
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function addBracket(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament._id}/brackets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: bName, minPower: Number(bMin),
          maxPower: bMax.trim() === "" ? null : Number(bMax), allowOverlap: bOverlap,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add bracket");
      push(`Added bracket "${bName}".`, "success");
      setBName("");
      await onRefresh();
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteBracket(bracketId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament._id}/brackets?bracketId=${encodeURIComponent(bracketId)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      push("Bracket deleted.", "info");
      await onRefresh();
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function runLifecycle(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament._id}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lifecycle transition failed");
      if (action === "clone" && data.tournament?._id) {
        push(`Cloned into draft "${data.tournament.name}".`, "success");
        router.push(`/tournaments/${data.tournament._id}`);
        return;
      }
      push(`Tournament updated → ${data.status || action}.`, "success");
      await onRefresh();
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTournament() {
    if (!window.confirm(`Permanently delete "${tournament.name}" and all associated records?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete tournament");
      push("Tournament deleted.", "info");
      router.push("/");
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const readyToPublish = tournament.status === "draft" && (!tournament.bracketsEnabled || tournament.brackets.length > 0);

  if (!canManage) {
    return (
      <div className="arena-card p-6 text-center text-sm text-[var(--arena-muted)]">
        <Lock className="mx-auto mb-2 h-6 w-6 text-amber-500" />
        Only non-participating tournament managers or Bot Administrators can access Setup & Publish controls.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="arena-card overflow-hidden border-amber-500/40">
        <div className="bg-gradient-to-r from-amber-500/15 via-cyan-500/10 to-transparent p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-500">
              <Rocket className="h-4 w-4" /> Tournament Lifecycle Control
            </div>
            <h3 className="font-display-caps mt-1 text-xl font-bold">
              {tournament.status === "draft" ? "Draft Mode — Finish Setup & Publish" : `Stage: ${tournament.status.replace(/_/g, " ").toUpperCase()}`}
            </h3>
            <p className="mt-1 text-xs text-[var(--arena-muted)]">
              Draft → Registration Open (Published) → Registration Closed → Matchmaking → In Progress → Completed
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tournament.status === "draft" && (
              <button type="button" disabled={busy || !readyToPublish} onClick={() => runLifecycle("publish")} className="arena-btn-primary shadow-glowGold">
                <Rocket className="h-4 w-4" /> Publish Tournament
              </button>
            )}
            {tournament.status === "registration" && (
              <button type="button" disabled={busy} onClick={() => runLifecycle("close_registration")} className="arena-btn-primary">
                <Lock className="h-4 w-4" /> Close Registration & Lock Teams
              </button>
            )}
            {tournament.status === "registration_closed" && (
              <>
                <button type="button" disabled={busy} onClick={() => runLifecycle("publish")} className="arena-btn-secondary">Reopen Registration</button>
                <button type="button" disabled={busy} onClick={() => runLifecycle("start")} className="arena-btn-primary"><Play className="h-4 w-4" /> Start</button>
              </>
            )}
            {tournament.status === "in_progress" && (
              <>
                <button type="button" disabled={busy} onClick={() => runLifecycle("pause", { reason: window.prompt("Pause reason (optional):") || "" })} className="arena-btn-secondary"><Pause className="h-4 w-4" /> Pause</button>
                <button type="button" disabled={busy} onClick={() => runLifecycle("finish", { force: window.confirm("Force finish if unresolved matches remain? Cancel = require all resolved.") })} className="arena-btn-primary"><CheckCircle2 className="h-4 w-4" /> Finish & Freeze</button>
              </>
            )}
            {tournament.status === "paused" && (
              <>
                <button type="button" disabled={busy} onClick={() => runLifecycle("resume")} className="arena-btn-primary"><Play className="h-4 w-4" /> Resume</button>
                <button type="button" disabled={busy} onClick={() => runLifecycle("finish", { force: true })} className="arena-btn-secondary">Force Finish</button>
              </>
            )}
            {["completed", "cancelled"].includes(tournament.status) && (
              <button type="button" disabled={busy} onClick={() => runLifecycle("archive")} className="arena-btn-secondary"><Archive className="h-4 w-4" /> Archive</button>
            )}
            <button type="button" disabled={busy} onClick={() => { const n = window.prompt("Cloned draft name:", `${tournament.name} S2`); if (n) runLifecycle("clone", { newName: n }); }} className="arena-btn-secondary"><Copy className="h-4 w-4" /> Clone</button>
            {!["completed", "cancelled", "archived"].includes(tournament.status) && (
              <button type="button" disabled={busy} onClick={() => { const r = window.prompt("Cancellation reason:"); if (r) runLifecycle("cancel", { reason: r }); }} className="arena-btn-danger"><XCircle className="h-4 w-4" /> Cancel</button>
            )}
            <button type="button" disabled={busy} onClick={deleteTournament} className="arena-btn-danger"><Trash2 className="h-4 w-4" /> Delete</button>
          </div>
        </div>

        {tournament.status === "draft" && (
          <div className="border-t border-[var(--arena-border)] px-5 py-3 bg-[var(--arena-elevated)]/60 flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-500 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> Draft Created</span>
            <span className={`flex items-center gap-1.5 font-semibold ${readyToPublish ? "text-emerald-500" : "text-amber-500"}`}>
              {readyToPublish ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {tournament.bracketsEnabled ? `Brackets (${tournament.brackets.length})` : "Open Division (No Brackets)"}
            </span>
          </div>
        )}
      </div>

      <div className="arena-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-display-caps text-base font-bold flex items-center gap-2"><Layers className="h-4 w-4 text-cyan-500" /> Squad Power / XP Brackets</h4>
            <p className="text-xs text-[var(--arena-muted)]">Optional power divisions (e.g., Mech Arena SP ranges). Overlap protection is active by default.</p>
          </div>
          {locked && <span className="text-xs font-semibold text-amber-500 flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Locked</span>}
        </div>

        {!tournament.bracketsEnabled ? (
          <p className="text-xs text-[var(--arena-muted)] bg-[var(--arena-elevated)] rounded-lg p-3">
            Brackets disabled. Enable &ldquo;Use Squad-Power Brackets&rdquo; below and save to configure divisions.
          </p>
        ) : (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {tournament.brackets.map((b) => (
                <div key={b._id} className="flex items-center justify-between rounded-xl border border-[var(--arena-border)] bg-[var(--arena-elevated)] p-3">
                  <div>
                    <div className="font-bold text-sm">{b.name}</div>
                    <div className="font-mono text-xs text-cyan-500">
                      {b.minPower.toLocaleString()} – {b.maxPower !== null ? b.maxPower.toLocaleString() : "∞"} SP
                    </div>
                  </div>
                  {!locked && (
                    <button type="button" onClick={() => deleteBracket(b._id)} className="text-red-500 hover:bg-red-500/15 p-1.5 rounded-lg" title="Delete bracket">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!locked && (
              <form onSubmit={addBracket} className="grid gap-3 sm:grid-cols-5 items-end pt-2 border-t border-[var(--arena-border)]">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold uppercase text-[var(--arena-muted)]">Bracket Name</label>
                  <input className="arena-input mt-1" placeholder="e.g. Bracket 1 — 1k to 4k" value={bName} onChange={(e) => setBName(e.target.value)} required />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-[var(--arena-muted)]">Min SP / XP</label>
                  <input type="number" min="0" className="arena-input mt-1 font-mono" value={bMin} onChange={(e) => setBMin(e.target.value)} required />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-[var(--arena-muted)]">Max (blank = ∞)</label>
                  <input type="number" min="0" className="arena-input mt-1 font-mono" placeholder="Unlimited" value={bMax} onChange={(e) => setBMax(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-1.5 text-[11px] text-[var(--arena-muted)]">
                    <input type="checkbox" checked={bOverlap} onChange={(e) => setBOverlap(e.target.checked)} /> Allow overlap
                  </label>
                  <button type="submit" disabled={busy} className="arena-btn-primary w-full"><Plus className="h-4 w-4" /> Add</button>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      <form onSubmit={saveConfig} className="arena-card p-5 space-y-6">
        <div className="flex items-center justify-between">
          <h4 className="font-display-caps text-base font-bold flex items-center gap-2"><Sliders className="h-4 w-4 text-amber-500" /> Tournament Configuration</h4>
          {!locked && <button type="submit" disabled={busy} className="arena-btn-primary"><Save className="h-4 w-4" /> Save Settings</button>}
        </div>

        <fieldset disabled={locked || busy} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Tournament Name</label>
              <input className="arena-input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Scoring System</label>
              <select className="arena-input mt-1" value={scoring} onChange={(e) => setScoring(e.target.value as TournamentDTO["scoring"])}>
                {SCORING_SYSTEMS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toUpperCase()}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Rules & Description</label>
              <textarea rows={3} className="arena-input mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Allowed Maps (comma-separated)</label>
              <input className="arena-input mt-1" placeholder="Agora, Forbidden City, Sky Ship" value={mapsText} onChange={(e) => setMapsText(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Tie-Breakers</label>
              <input className="arena-input mt-1 font-mono text-xs" value={tieBreakers} onChange={(e) => setTieBreakers(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 border-t border-[var(--arena-border)] pt-4">
            <div>
              <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Start Date/Time</label>
              <input type="datetime-local" className="arena-input mt-1" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">End Date/Time</label>
              <input type="datetime-local" className="arena-input mt-1" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Deadline (Hours)</label>
              <input type="number" min="1" max="720" className="arena-input mt-1 font-mono" value={deadlineHrs} onChange={(e) => setDeadlineHrs(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Duration (Mins)</label>
              <input type="number" min="15" max="240" className="arena-input mt-1 font-mono" value={durationMins} onChange={(e) => setDurationMins(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Best-Of Series (Odd)</label>
              <input type="number" min="1" max="15" step="2" className="arena-input mt-1 font-mono" value={seriesBestOf} onChange={(e) => setSeriesBestOf(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Swiss Rounds (0 = Auto)</label>
              <input type="number" min="0" max="20" className="arena-input mt-1 font-mono" value={swissRounds} onChange={(e) => setSwissRounds(e.target.value)} />
            </div>
            {scoring === "combined" && (
              <div>
                <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Win / SP / Pts Weights</label>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  <input type="number" className="arena-input font-mono text-xs" value={winWeight} onChange={(e) => setWinWeight(e.target.value)} />
                  <input type="number" className="arena-input font-mono text-xs" value={powerWeight} onChange={(e) => setPowerWeight(e.target.value)} />
                  <input type="number" className="arena-input font-mono text-xs" value={pointsWeight} onChange={(e) => setPointsWeight(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-5 border-t border-[var(--arena-border)] pt-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={bracketsEnabled} onChange={(e) => setBracketsEnabled(e.target.checked)} /> Use Squad-Power Brackets</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={proofRequired} onChange={(e) => setProofRequired(e.target.checked)} /> Require Proof Screenshot</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={approvalRequired} onChange={(e) => setApprovalRequired(e.target.checked)} /> Require Manager Approval</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={allowDraws} onChange={(e) => setAllowDraws(e.target.checked)} /> Allow Draws</label>
          </div>

          {tournament.mode === "team" && (
            <div className="border-t border-[var(--arena-border)] pt-4 space-y-3">
              <div className="text-xs font-bold uppercase text-cyan-500">Team Tournament Settings</div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Min Team Size</label>
                  <input type="number" min="1" max="20" className="arena-input mt-1 font-mono" value={teamMin} onChange={(e) => setTeamMin(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Max Team Size</label>
                  <input type="number" min="1" max="20" className="arena-input mt-1 font-mono" value={teamMax} onChange={(e) => setTeamMax(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Team Power Rule</label>
                  <select className="arena-input mt-1" value={teamPowerRule} onChange={(e) => setTeamPowerRule(e.target.value as TournamentDTO["teamPowerRule"])}>
                    {TEAM_POWER_RULES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ").toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-5 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={allowIncomplete} onChange={(e) => setAllowIncomplete(e.target.checked)} /> Allow Incomplete Teams</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={invitesOnly} onChange={(e) => setInvitesOnly(e.target.checked)} /> Invites-Only Teams</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={allowMultiTeams} onChange={(e) => setAllowMultiTeams(e.target.checked)} /> Allow Multiple Teams</label>
              </div>
            </div>
          )}

          <div className="border-t border-[var(--arena-border)] pt-4 space-y-3">
            <div className="text-xs font-bold uppercase text-amber-500 flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Discord Roles & Channels</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Manager Role IDs</label><input className="arena-input mt-1 font-mono text-xs" value={managerRoles} onChange={(e) => setManagerRoles(e.target.value)} /></div>
              <div><label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Reviewer Role IDs</label><input className="arena-input mt-1 font-mono text-xs" value={reviewerRoles} onChange={(e) => setReviewerRoles(e.target.value)} /></div>
              <div><label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Head Manager Role IDs</label><input className="arena-input mt-1 font-mono text-xs" value={headRoles} onChange={(e) => setHeadRoles(e.target.value)} /></div>
              <div><label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Announcement Channel ID</label><input className="arena-input mt-1 font-mono text-xs" value={announceCh} onChange={(e) => setAnnounceCh(e.target.value)} /></div>
            </div>
          </div>

          <div className="border-t border-[var(--arena-border)] pt-4 space-y-3">
            <div className="text-xs font-bold uppercase text-amber-500 flex items-center gap-1.5"><Award className="h-3.5 w-3.5" /> Podium Prizes & Discord Award Role IDs</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-bold text-amber-500">1st Place</label>
                <input className="arena-input mt-1" placeholder="Prize description" value={prize1} onChange={(e) => setPrize1(e.target.value)} />
                <input className="arena-input mt-1.5 font-mono text-xs" placeholder="Award Role ID" value={awardRole1} onChange={(e) => setAwardRole1(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400">2nd Place</label>
                <input className="arena-input mt-1" placeholder="Prize description" value={prize2} onChange={(e) => setPrize2(e.target.value)} />
                <input className="arena-input mt-1.5 font-mono text-xs" placeholder="Award Role ID" value={awardRole2} onChange={(e) => setAwardRole2(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-orange-400">3rd Place</label>
                <input className="arena-input mt-1" placeholder="Prize description" value={prize3} onChange={(e) => setPrize3(e.target.value)} />
                <input className="arena-input mt-1.5 font-mono text-xs" placeholder="Award Role ID" value={awardRole3} onChange={(e) => setAwardRole3(e.target.value)} />
              </div>
            </div>
          </div>
        </fieldset>
      </form>
    </div>
  );
}

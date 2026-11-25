"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  Crown,
  Layers,
  Lock,
  Plus,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  DiscordChannelPicker,
  DiscordRoleMultiPicker,
  DiscordSingleRolePicker,
} from "@/components/DiscordRolePicker";
import { useTournamentDetail } from "@/components/TournamentDetailContext";
import {
  SCORING_LABELS,
  type TournamentScoring,
} from "@/lib/tournament-types";

export default function TournamentSettingsPage() {
  const router = useRouter();
  const { guildId, data, busy, runAction, setError, showToast } =
    useTournamentDetail();

  // Moderator & Discord Roles state (Owner Only writes)
  const [managerRoleIds, setManagerRoleIds] = useState<string[]>([]);
  const [reviewerRoleIds, setReviewerRoleIds] = useState<string[]>([]);
  const [headManagerRoleIds, setHeadManagerRoleIds] = useState<string[]>([]);
  const [awardFirst, setAwardFirst] = useState("");
  const [awardSecond, setAwardSecond] = useState("");
  const [awardThird, setAwardThird] = useState("");
  const [announcementChannelId, setAnnouncementChannelId] = useState("");

  // Rules & Settings state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scoring, setScoring] = useState<TournamentScoring>("wins");
  const [mapsCsv, setMapsCsv] = useState("");
  const [seriesBestOf, setSeriesBestOf] = useState(3);
  const [swissRounds, setSwissRounds] = useState(0);
  const [deadlineHours, setDeadlineHours] = useState(48);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [proofRequired, setProofRequired] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [allowDraws, setAllowDraws] = useState(false);
  const [teamInvitesOnly, setTeamInvitesOnly] = useState(false);
  const [allowIncompleteTeams, setAllowIncompleteTeams] = useState(false);
  const [firstPrize, setFirstPrize] = useState("");
  const [secondPrize, setSecondPrize] = useState("");
  const [thirdPrize, setThirdPrize] = useState("");

  // Bracket quick-add
  const [bName, setBName] = useState("");
  const [bMin, setBMin] = useState("0");
  const [bMax, setBMax] = useState("");

  const [deleting, setDeleting] = useState(false);

  const t = data?.tournament;
  const access = data?.access;

  useEffect(() => {
    if (!t) return;
    setManagerRoleIds(t.managerRoleIds || []);
    setReviewerRoleIds(t.reviewerRoleIds || []);
    setHeadManagerRoleIds(t.headManagerRoleIds || []);
    setAwardFirst(t.awardRoleIds?.first || "");
    setAwardSecond(t.awardRoleIds?.second || "");
    setAwardThird(t.awardRoleIds?.third || "");
    setAnnouncementChannelId(t.announcementChannelId || "");

    setName(t.name);
    setDescription(t.description || "");
    setScoring(t.scoring);
    setMapsCsv((t.maps || []).join(", "));
    setSeriesBestOf(t.seriesBestOf || 3);
    setSwissRounds(t.swissRounds || 0);
    setDeadlineHours(t.schedule.matchDeadlineHours || 48);
    setDurationMinutes(t.schedule.matchDurationMinutes || 60);
    setProofRequired(t.resultPolicy.proofRequired);
    setApprovalRequired(t.resultPolicy.approvalRequired);
    setAllowDraws(t.resultPolicy.allowDraws);
    setTeamInvitesOnly(t.teamInvitesOnly);
    setAllowIncompleteTeams(t.allowIncompleteTeams);
    setFirstPrize(t.prizeDescriptions.first || "");
    setSecondPrize(t.prizeDescriptions.second || "");
    setThirdPrize(t.prizeDescriptions.third || "");
  }, [t]);

  if (!data || !t || !access) return null;

  const isStaff = access.canManageTournament || access.canAssignModerators;
  if (!isStaff) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-amber-500/40 bg-slate-900/75 p-8 text-center">
        <Lock className="mx-auto mb-3 h-9 w-9 text-amber-400" />
        <h2 className="text-base font-extrabold text-white">
          Staff Settings Restricted
        </h2>
        <p className="mt-1.5 text-xs text-slate-400">
          Only the Server Owner, Tournament Owner, or assigned Moderators can
          view and configure tournament settings.
        </p>
      </div>
    );
  }

  async function handleSaveModerators(e: React.FormEvent) {
    e.preventDefault();
    await runAction(
      {
        action: "update_moderators",
        managerRoleIds,
        reviewerRoleIds,
        headManagerRoleIds,
        awardRoleIds: {
          first: awardFirst || undefined,
          second: awardSecond || undefined,
          third: awardThird || undefined,
        },
        announcementChannelId: announcementChannelId || null,
      },
      "Moderator roles & Discord channels updated! Role members synced with bot."
    );
  }

  async function handleSaveRules(e: React.FormEvent) {
    e.preventDefault();
    await runAction(
      {
        action: "update_settings",
        name: name.trim(),
        description: description.trim(),
        scoring,
        maps: mapsCsv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        seriesBestOf,
        swissRounds,
        matchDeadlineHours: deadlineHours,
        matchDurationMinutes: durationMinutes,
        proofRequired,
        approvalRequired,
        allowDraws,
        teamInvitesOnly,
        allowIncompleteTeams,
        prizes: {
          first: firstPrize.trim() || undefined,
          second: secondPrize.trim() || undefined,
          third: thirdPrize.trim() || undefined,
        },
      },
      "Tournament rules & prizes saved!"
    );
  }

  async function handleAddBracket(e: React.FormEvent) {
    e.preventDefault();
    if (!bName.trim()) return;
    const res = await runAction(
      {
        action: "add_bracket",
        bracket: {
          name: bName.trim(),
          minPower: Number(bMin),
          maxPower: bMax.trim() === "" ? null : Number(bMax),
        },
      },
      `Added SP bracket "${bName.trim()}".`
    );
    if (res.ok) {
      setBName("");
      setBMin("0");
      setBMax("");
    }
  }

  async function handleDeleteTournament() {
    if (
      !confirm(
        `Permanently delete "${t!.name}" and all its registrations, teams, and match records? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tournaments/${encodeURIComponent(t!.id)}`,
        { method: "DELETE", credentials: "include" }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not delete tournament.");
        return;
      }
      showToast("Tournament deleted.");
      router.push(`/servers/${guildId}/tournaments`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* SECTION 1: Moderator Roles & Discord Integration (Owner Only Writes!) */}
      <form
        onSubmit={handleSaveModerators}
        className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Moderator Roles &amp; Discord Integration
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {access.canAssignModerators
                ? "Assign Discord roles whose members receive full admin management access when they sign into this tournament."
                : "Only the Server Owner or Tournament Owner can modify Moderator role assignments."}
            </p>
          </div>
          {!access.canAssignModerators && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
              <Lock className="h-3 w-3" /> Owner Only
            </span>
          )}
        </div>

        <DiscordRoleMultiPicker
          roles={data.discordRoles}
          selectedIds={managerRoleIds}
          onChange={setManagerRoleIds}
          label="Tournament Moderator Roles"
          hint="Full admin access for this tournament (proof approval, match review, lifecycle, result declaration)."
          disabled={!access.canAssignModerators}
        />

        <div className="grid grid-cols-1 gap-4 border-t border-slate-800/80 pt-4 sm:grid-cols-2">
          <DiscordRoleMultiPicker
            roles={data.discordRoles}
            selectedIds={reviewerRoleIds}
            onChange={setReviewerRoleIds}
            label="Result Reviewer Roles"
            disabled={!access.canAssignModerators}
          />
          <DiscordRoleMultiPicker
            roles={data.discordRoles}
            selectedIds={headManagerRoleIds}
            onChange={setHeadManagerRoleIds}
            label="Head Manager Roles (Escalations)"
            disabled={!access.canAssignModerators}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-slate-800/80 pt-4 sm:grid-cols-3">
          <DiscordSingleRolePicker
            roles={data.discordRoles}
            value={awardFirst}
            onChange={setAwardFirst}
            label="1st Place Discord Award Role"
            disabled={!access.canAssignModerators}
          />
          <DiscordSingleRolePicker
            roles={data.discordRoles}
            value={awardSecond}
            onChange={setAwardSecond}
            label="2nd Place Discord Award Role"
            disabled={!access.canAssignModerators}
          />
          <DiscordSingleRolePicker
            roles={data.discordRoles}
            value={awardThird}
            onChange={setAwardThird}
            label="3rd Place Discord Award Role"
            disabled={!access.canAssignModerators}
          />
        </div>

        <div className="border-t border-slate-800/80 pt-4">
          <DiscordChannelPicker
            channels={data.discordChannels}
            value={announcementChannelId}
            onChange={setAnnouncementChannelId}
            label="Tournament Announcement Channel"
            disabled={!access.canAssignModerators}
          />
        </div>

        {access.canAssignModerators && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-indigo-500 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              Save Moderator Roles &amp; Channels
            </button>
          </div>
        )}
      </form>

      {/* SECTION 2: Tournament Rules & Prizes */}
      <form
        onSubmit={handleSaveRules}
        className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
              <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
              Tournament Configuration &amp; Prizes
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {t.settingsLocked
                ? "Core settings are locked because play has started."
                : "Editable until matchmaking/play begins."}
            </p>
          </div>
          {t.settingsLocked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
              <Lock className="h-3 w-3" /> Locked After Start
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-200">
              Tournament Name
            </label>
            <input
              disabled={t.settingsLocked || !access.canManageTournament}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-200">
              Scoring Model
            </label>
            <select
              disabled={t.settingsLocked || !access.canManageTournament}
              value={scoring}
              onChange={(e) => setScoring(e.target.value as TournamentScoring)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"
            >
              {(Object.keys(SCORING_LABELS) as TournamentScoring[]).map((sc) => (
                <option key={sc} value={sc}>
                  {SCORING_LABELS[sc]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-200">
            Description &amp; Rules
          </label>
          <textarea
            rows={3}
            disabled={t.settingsLocked || !access.canManageTournament}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-white disabled:opacity-60"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-300">
              Deadline (hrs)
            </label>
            <input
              type="number"
              min={1}
              max={720}
              disabled={t.settingsLocked || !access.canManageTournament}
              value={deadlineHours}
              onChange={(e) => setDeadlineHours(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-300">
              Duration (mins)
            </label>
            <input
              type="number"
              min={15}
              max={240}
              disabled={t.settingsLocked || !access.canManageTournament}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-300">
              Series Best-Of
            </label>
            <input
              type="number"
              min={1}
              max={15}
              step={2}
              disabled={t.settingsLocked || !access.canManageTournament}
              value={seriesBestOf}
              onChange={(e) => setSeriesBestOf(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-300">
              Swiss Rounds
            </label>
            <input
              type="number"
              min={0}
              max={20}
              disabled={t.settingsLocked || !access.canManageTournament}
              value={swissRounds}
              onChange={(e) => setSwissRounds(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-200">
            Map Rotation (comma-separated)
          </label>
          <input
            disabled={t.settingsLocked || !access.canManageTournament}
            value={mapsCsv}
            onChange={(e) => setMapsCsv(e.target.value)}
            placeholder="Agora, Skyship, Forbidden City"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"
          />
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {[
            { label: "Proof Required", val: proofRequired, set: setProofRequired },
            { label: "Staff Approval", val: approvalRequired, set: setApprovalRequired },
            { label: "Allow Draws", val: allowDraws, set: setAllowDraws },
          ].map((chk) => (
            <label
              key={chk.label}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5 text-xs font-semibold text-slate-200"
            >
              <input
                type="checkbox"
                disabled={t.settingsLocked || !access.canManageTournament}
                checked={chk.val}
                onChange={(e) => chk.set(e.target.checked)}
                className="h-4 w-4 accent-indigo-500"
              />
              {chk.label}
            </label>
          ))}
        </div>

        {t.mode === "team" && (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5 text-xs font-semibold text-slate-200">
              <input
                type="checkbox"
                disabled={t.settingsLocked || !access.canManageTournament}
                checked={teamInvitesOnly}
                onChange={(e) => setTeamInvitesOnly(e.target.checked)}
                className="h-4 w-4 accent-indigo-500"
              />
              Invite-Only Team Joins
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5 text-xs font-semibold text-slate-200">
              <input
                type="checkbox"
                disabled={t.settingsLocked || !access.canManageTournament}
                checked={allowIncompleteTeams}
                onChange={(e) => setAllowIncompleteTeams(e.target.checked)}
                className="h-4 w-4 accent-indigo-500"
              />
              Allow Incomplete Teams
            </label>
          </div>
        )}

        <div className="space-y-2 border-t border-slate-800/80 pt-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <Crown className="h-3.5 w-3.5 text-amber-400" />
            Podium Prize Descriptions
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <input
              disabled={t.settingsLocked || !access.canManageTournament}
              value={firstPrize}
              onChange={(e) => setFirstPrize(e.target.value)}
              placeholder="1st Prize"
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"
            />
            <input
              disabled={t.settingsLocked || !access.canManageTournament}
              value={secondPrize}
              onChange={(e) => setSecondPrize(e.target.value)}
              placeholder="2nd Prize"
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"
            />
            <input
              disabled={t.settingsLocked || !access.canManageTournament}
              value={thirdPrize}
              onChange={(e) => setThirdPrize(e.target.value)}
              placeholder="3rd Prize"
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"
            />
          </div>
        </div>

        {!t.settingsLocked && access.canManageTournament && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-indigo-500 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              Save Tournament Rules
            </button>
          </div>
        )}
      </form>

      {/* SECTION 3: Squad-Power Brackets Manager */}
      {t.bracketsEnabled && (
        <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
            <Layers className="h-4 w-4 text-amber-400" />
            Power Brackets ({t.brackets.length})
          </h2>

          {t.brackets.length > 0 && (
            <div className="space-y-2">
              {t.brackets.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2.5 text-xs"
                >
                  <div>
                    <strong className="text-white">{b.name}</strong>
                    <span className="ml-2 font-mono text-indigo-300">
                      {b.minPower} – {b.maxPower ?? "∞"} SP
                    </span>
                  </div>
                  {!t.settingsLocked && access.canManageTournament && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          { action: "delete_bracket", bracketName: b.name },
                          `Removed bracket "${b.name}".`
                        )
                      }
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!t.settingsLocked && access.canManageTournament && (
            <form
              onSubmit={handleAddBracket}
              className="grid grid-cols-1 gap-2.5 border-t border-slate-800/80 pt-4 sm:grid-cols-4"
            >
              <input
                required
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                placeholder="Bracket Name"
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
              />
              <input
                required
                type="number"
                min={0}
                value={bMin}
                onChange={(e) => setBMin(e.target.value)}
                placeholder="Min SP"
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
              />
              <input
                type="number"
                min={0}
                value={bMax}
                onChange={(e) => setBMax(e.target.value)}
                placeholder="Max SP (blank = ∞)"
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
              />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Add Bracket
              </button>
            </form>
          )}
        </section>
      )}

      {/* SECTION 4: Danger Zone */}
      <section className="space-y-4 rounded-3xl border border-rose-500/35 bg-rose-500/10 p-6">
        <div className="flex items-center gap-2 text-sm font-extrabold text-rose-300">
          <AlertTriangle className="h-4 w-4" />
          Lifecycle &amp; Danger Zone
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {access.canManageTournament &&
            t.status === "registration_closed" &&
            !t.settingsLocked &&
            t.counts.matches === 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction(
                    { action: "reopen_registration" },
                    "Registration reopened!"
                  )
                }
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:border-indigo-500"
              >
                Reopen Registration
              </button>
            )}

          {access.canManageTournament &&
            !["completed", "cancelled", "archived"].includes(t.status) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt("Reason for cancelling this tournament?") || "";
                  if (!reason.trim()) return;
                  runAction(
                    { action: "cancel", reason: reason.trim() },
                    "Tournament cancelled."
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-xs font-bold text-amber-300"
              >
                <XCircle className="h-3.5 w-3.5" />
                Cancel Tournament
              </button>
            )}

          {access.canManageTournament &&
            ["completed", "cancelled"].includes(t.status) && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction({ action: "archive" }, "Tournament archived.")
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:border-indigo-500"
              >
                <Archive className="h-3.5 w-3.5" />
                Archive Tournament
              </button>
            )}

          {access.canDeleteTournament && (
            <button
              type="button"
              disabled={deleting}
              onClick={handleDeleteTournament}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? "Deleting..." : "Delete Permanently"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

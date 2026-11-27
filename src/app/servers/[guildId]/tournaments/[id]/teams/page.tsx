"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ban, CheckCircle2, Crown, Lock, Search, Shield, Users, UsersRound } from "lucide-react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { CopyButton } from "@/components/CopyButton";
import { useTournamentDetail } from "@/components/TournamentDetailContext";
import type { TeamRow } from "@/lib/tournament-types";

export default function TournamentTeamsPage() {
  const { guildId, data, refresh, showToast, setError } = useTournamentDetail();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [teamActionTarget, setTeamActionTarget] = useState<{
    team: TeamRow;
    action: "disqualify" | "reinstate";
  } | null>(null);
  const [teamBusy, setTeamBusy] = useState(false);

  const t = data?.tournament;
  const teams = useMemo(() => data?.teams || [], [data?.teams]);
  const regs = useMemo(() => data?.registrations || [], [data?.registrations]);

  const regByUser = useMemo(
    () => new Map(regs.map((r) => [r.userId, r])),
    [regs]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((tm) => {
      if (statusFilter !== "all" && tm.status !== statusFilter) return false;
      if (!q) return true;
      return (
        tm.name.toLowerCase().includes(q) ||
        tm.captainId.includes(q) ||
        tm.memberIds.some((uid) => uid.includes(q))
      );
    });
  }, [teams, statusFilter, search]);

  if (!data || !t) return null;
  const canManage = data.access.canManageTournament;

  async function handleConfirmTeamAction(reasonText: string) {
    if (!teamActionTarget) return;
    setTeamBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tournaments/${encodeURIComponent(t!.id)}/teams`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId: teamActionTarget.team.id,
            action: teamActionTarget.action,
            reason: reasonText,
          }),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Team update failed.");
        return;
      }
      showToast(
        teamActionTarget.action === "disqualify"
          ? `Disqualified team "${teamActionTarget.team.name}".`
          : `Reinstated team "${teamActionTarget.team.name}".`
      );
      setTeamActionTarget(null);
      await refresh();
    } finally {
      setTeamBusy(false);
    }
  }

  if (t.mode !== "team") {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-10 text-center">
        <Users className="mx-auto mb-3 h-10 w-10 text-indigo-400" />
        <h2 className="text-base font-extrabold text-white">
          Individual / Solo Tournament
        </h2>
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
          This tournament is configured in Solo (1v1) mode, so players compete
          individually without teams.
        </p>
        <Link
          href={`/servers/${guildId}/tournaments/${t.id}/players`}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
        >
          View Players &amp; Power
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Team Rules & Quick Commands */}
      <section className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
              <UsersRound className="h-4 w-4 text-amber-400" />
              Teams &amp; Squad Rosters ({teams.length})
            </h2>
            {t.teamsLocked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-300">
                <Lock className="h-3 w-3" /> Rosters Locked
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Team Size: <strong className="text-white">{t.teamSizeMin}–{t.teamSizeMax}</strong>{" "}
            players · Power Rule:{" "}
            <strong className="capitalize text-white">
              {t.teamPowerRule.replace("_", " ")}
            </strong>{" "}
            {t.teamInvitesOnly ? "· Invite-Only Joins" : "· Open / Invite Joins"}
          </p>
        </div>

        {t.status === "registration" && !t.teamsLocked && (
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton
              value={`/team create tournament_id:${t.id} name:`}
              label="Copy /team create"
            />
            <CopyButton
              value={`/team join tournament_id:${t.id} team_name:`}
              label="Copy /team join"
            />
          </div>
        )}
      </section>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team name or member ID..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {[
            { id: "active", label: "Active" },
            { id: "all", label: `All (${teams.length})` },
            { id: "disqualified", label: "Disqualified" },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setStatusFilter(pill.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === pill.id
                  ? "bg-indigo-600 text-white"
                  : "border border-slate-800 bg-slate-950 text-slate-300"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Team Cards Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-12 text-center text-xs text-slate-400">
          No teams registered yet. Captains can create squads in Discord with{" "}
          <code className="text-indigo-400">/team create</code>.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((tm) => {
            const rosterFull = tm.memberIds.length >= t.teamSizeMax;
            const rosterEligible = tm.memberIds.length >= t.teamSizeMin;
            return (
              <div
                key={tm.id}
                className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900/70 p-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {tm.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={tm.logoUrl}
                          alt={tm.name}
                          className="h-11 w-11 shrink-0 rounded-2xl border border-slate-700 object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-black text-white">
                          {tm.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-extrabold text-white">
                          {tm.name}
                        </h3>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span
                            className={`rounded-full px-2 py-0.5 font-extrabold uppercase ${
                              tm.status === "active"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-rose-500/15 text-rose-300"
                            }`}
                          >
                            {tm.status}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 font-bold ${
                              rosterEligible
                                ? "bg-indigo-500/15 text-indigo-300"
                                : "bg-amber-500/15 text-amber-300"
                            }`}
                          >
                            {tm.memberIds.length}/{t.teamSizeMax} Players
                            {rosterFull ? " (Full)" : ""}
                          </span>
                          {tm.bracketName && (
                            <span className="rounded-md bg-slate-800 px-2 py-0.5 font-bold text-slate-300">
                              {tm.bracketName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-xs">
                      <div className="font-extrabold text-white">
                        {tm.wins}W / {tm.losses}L
                      </div>
                      <div className="font-mono text-[11px] text-indigo-300">
                        {tm.points} pts
                      </div>
                    </div>
                  </div>

                  {/* Roster List */}
                  <div className="mt-4 space-y-1.5 border-t border-slate-800/80 pt-3">
                    {tm.memberIds.map((uid) => {
                      const reg = regByUser.get(uid);
                      const isCaptain = uid === tm.captainId;
                      return (
                        <div
                          key={uid}
                          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {isCaptain ? (
                              <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                            ) : (
                              <Shield className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                            )}
                            <span className="truncate font-bold text-white">
                              {reg?.inGameId ||
                                reg?.discordDisplayName ||
                                reg?.discordUsername ||
                                `Player #${uid.slice(-4)}`}
                            </span>
                            {isCaptain && (
                              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                                Captain
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-slate-400">
                            {reg?.verifiedSquadPower !== null &&
                            reg?.verifiedSquadPower !== undefined
                              ? `${reg.verifiedSquadPower} SP`
                              : "SP pending"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {(tm.verifiedPower > 0 || canManage) && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-400">
                    <div>
                      {tm.verifiedPower > 0 && (
                        <span>
                          Verified Power:{" "}
                          <strong className="font-mono text-emerald-400">
                            {tm.verifiedPower} SP
                          </strong>
                        </span>
                      )}
                    </div>
                    {canManage && (
                      <div>
                        {tm.status === "active" ? (
                          <button
                            type="button"
                            onClick={() =>
                              setTeamActionTarget({
                                team: tm,
                                action: "disqualify",
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/35 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-500/20"
                          >
                            <Ban className="h-3 w-3" />
                            Disqualify Team
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setTeamActionTarget({
                                team: tm,
                                action: "reinstate",
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/20"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Reinstate Team
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
          <ConfirmModal
        open={Boolean(teamActionTarget)}
        title={
          teamActionTarget?.action === "disqualify"
            ? `Disqualify "${teamActionTarget.team.name}"?`
            : `Reinstate "${teamActionTarget?.team.name || ""}"?`
        }
        description={
          teamActionTarget?.action === "disqualify"
            ? "This team will be marked disqualified while preserving existing match records for audit history."
            : "This team will be restored to active status in the tournament."
        }
        confirmLabel={
          teamActionTarget?.action === "disqualify"
            ? "Disqualify Team"
            : "Reinstate Team"
        }
        variant={teamActionTarget?.action === "disqualify" ? "danger" : "primary"}
        inputLabel={
          teamActionTarget?.action === "disqualify"
            ? "Disqualification Reason"
            : "Note (Optional)"
        }
        inputPlaceholder="Provide a brief reason for the audit log..."
        inputRequired={teamActionTarget?.action === "disqualify"}
        busy={teamBusy}
        onClose={() => setTeamActionTarget(null)}
        onConfirm={handleConfirmTeamAction}
      />
    </div>
  );
}

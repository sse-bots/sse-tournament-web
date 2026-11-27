"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Crown,
  Download,
  Lock,
  Medal,
  Send,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { DiscordChannelPicker } from "@/components/DiscordRolePicker";
import { useTournamentDetail } from "@/components/TournamentDetailContext";
import { SCORING_LABELS } from "@/lib/tournament-types";

export default function TournamentStandingsPage() {
  const { data, busy, runAction } = useTournamentDetail();
  const [bracketFilter, setBracketFilter] = useState<string>("all");
  const [declareOpen, setDeclareOpen] = useState(false);
  const [forceDeclare, setForceDeclare] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postChannelId, setPostChannelId] = useState("");

  const t = data?.tournament;
  const access = data?.access;
  const regs = useMemo(() => data?.registrations || [], [data?.registrations]);
  const teams = useMemo(() => data?.teams || [], [data?.teams]);
  const matches = useMemo(() => data?.matches || [], [data?.matches]);
  const roles = useMemo(() => data?.discordRoles || [], [data?.discordRoles]);

  const roleNameMap = useMemo(
    () => new Map(roles.map((r) => [r.id, r.name])),
    [roles]
  );

  const regNameMap = useMemo(
    () =>
      new Map(
        regs.map((r) => [
          r.userId,
          r.inGameId || r.discordDisplayName || r.discordUsername || `Player #${r.userId.slice(-4)}`,
        ])
      ),
    [regs]
  );

  const unresolvedCount = useMemo(
    () =>
      matches.filter((m) =>
        [
          "scheduled",
          "ready",
          "in_progress",
          "pending_review",
          "rejected",
          "disputed",
          "postponed",
        ].includes(m.status)
      ).length,
    [matches]
  );

  // Preview podium winners per bracket for the Declaration Studio modal
  const previewPodiums = useMemo(() => {
    if (!t) return [];
    const groups = t.bracketsEnabled
      ? t.brackets.map((b) => ({ name: b.name, id: b.id }))
      : [{ name: "Overall", id: null as string | null }];

    return groups.map((bg) => {
      if (t.mode === "individual") {
        const top = regs
          .filter(
            (r) =>
              r.status === "registered" &&
              (bg.id === null || r.bracketId === bg.id)
          )
          .slice(0, 3)
          .map((r, idx) => ({
            place: idx + 1,
            label:
              r.inGameId ||
              r.discordDisplayName ||
              r.discordUsername ||
              `Player #${r.userId.slice(-4)}`,
            wins: r.wins,
            losses: r.losses,
            points: r.points,
          }));
        return { bracket: bg.name, winners: top };
      }
      const top = teams
        .filter(
          (tm) =>
            tm.status === "active" &&
            (bg.id === null || tm.bracketId === bg.id)
        )
        .slice(0, 3)
        .map((tm, idx) => ({
          place: idx + 1,
          label: tm.name,
          wins: tm.wins,
          losses: tm.losses,
          points: tm.points,
        }));
      return { bracket: bg.name, winners: top };
    });
  }, [t, regs, teams]);

  if (!data || !t || !access) return null;

  const canDeclare =
    access.canDeclareResults && ["in_progress", "paused"].includes(t.status);

  const filteredRegs = regs.filter(
    (r) =>
      r.status === "registered" &&
      (bracketFilter === "all" || r.bracketId === bracketFilter)
  );
  const filteredTeams = teams.filter(
    (tm) =>
      tm.status === "active" &&
      (bracketFilter === "all" || tm.bracketId === bracketFilter)
  );

  const selectedBracketName =
    bracketFilter === "all"
      ? null
      : t.brackets.find((b) => b.id === bracketFilter)?.name || null;

  const frozenFiltered = t.finalStandings.filter(
    (row) => !selectedBracketName || row.bracket === selectedBracketName
  );

  async function handleConfirmDeclare() {
    const res = await runAction(
      { action: "finish", force: forceDeclare },
      "Official results declared & standings frozen! Bot is announcing podiums and granting award roles in Discord."
    );
    if (res.ok) {
      setDeclareOpen(false);
      setForceDeclare(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Declaration CTA */}
      <div className="flex flex-col justify-between gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-white">
            <Trophy className="h-5 w-5 text-amber-400" />
            Standings &amp; Official Results
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Ranked by <strong className="text-white">{SCORING_LABELS[t.scoring]}</strong>
            {t.standingsFrozen
              ? " · Official final podium frozen."
              : " · Live leaderboard updated as match proofs are approved."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {access.canManageTournament && (
            <button
              type="button"
              onClick={() => {
                setPostChannelId(t.announcementChannelId || "");
                setPostModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-3.5 py-2 text-xs font-bold text-indigo-300 transition hover:bg-indigo-500/25"
            >
              <Send className="h-3.5 w-3.5" />
              Post to Discord
            </button>
          )}

          {(access.canManageTournament || access.canAssignModerators) && (
            <a
              href={`/api/tournaments/${encodeURIComponent(t.id)}/export`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-slate-200 hover:border-indigo-500"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              Export CSV
            </a>
          )}

          {canDeclare && (
            <button
              type="button"
              onClick={() => setDeclareOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white shadow-lg transition hover:bg-emerald-500"
            >
              <Crown className="h-4 w-4" />
              Declare Final Results
            </button>
          )}
        </div>
      </div>

      {/* Bracket Filter Pills */}
      {t.bracketsEnabled && t.brackets.length > 0 && (
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setBracketFilter("all")}
            className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              bracketFilter === "all"
                ? "bg-indigo-600 text-white"
                : "border border-slate-800 bg-slate-900 text-slate-300 hover:border-indigo-500/50"
            }`}
          >
            All Brackets
          </button>
          {t.brackets.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBracketFilter(b.id)}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                bracketFilter === b.id
                  ? "bg-indigo-600 text-white"
                  : "border border-slate-800 bg-slate-900 text-slate-300 hover:border-indigo-500/50"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Official Frozen Podium Showcase */}
      {t.standingsFrozen && frozenFiltered.length > 0 && (
        <section className="space-y-4 rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <h3 className="text-base font-black text-white">
                Official Championship Podium
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-300">
              <Lock className="h-3 w-3" /> Frozen &amp; Announced
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {frozenFiltered.map((row, idx) => {
              const label = row.teamName
                ? row.teamName
                : row.userId
                  ? regNameMap.get(row.userId) || `Player #${row.userId.slice(-4)}`
                  : "Winner";
              const prize =
                row.place === 1
                  ? t.prizeDescriptions.first
                  : row.place === 2
                    ? t.prizeDescriptions.second
                    : row.place === 3
                      ? t.prizeDescriptions.third
                      : undefined;
              const isGold = row.place === 1;
              return (
                <div
                  key={`${row.bracket}-${row.place}-${idx}`}
                  className={`rounded-2xl border p-4 ${
                    isGold
                      ? "border-amber-500/50 bg-slate-900/90 shadow-lg"
                      : "border-slate-800 bg-slate-900/75"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-black ${
                        row.place === 1
                          ? "text-amber-400"
                          : row.place === 2
                            ? "text-slate-300"
                            : "text-orange-400"
                      }`}
                    >
                      {row.place === 1 ? (
                        <Crown className="h-4 w-4" />
                      ) : (
                        <Medal className="h-4 w-4" />
                      )}
                      #{row.place} Place
                    </span>
                    <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                      {row.bracket}
                    </span>
                  </div>

                  <div className="mt-2 truncate text-base font-extrabold text-white">
                    {label}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {row.wins}W / {row.losses}L ·{" "}
                    <strong className="text-indigo-300">{row.points} pts</strong>
                  </div>
                  {prize && (
                    <div className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                      <Award className="h-3.5 w-3.5" />
                      {prize}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Full Live Standings Table */}
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70">
        <div className="border-b border-slate-800/80 px-5 py-3.5">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            {t.mode === "team" ? "Team Standings" : "Individual Standings"} (
            {t.mode === "team" ? filteredTeams.length : filteredRegs.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          {t.mode === "team" ? (
            filteredTeams.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400">
                No active teams in this bracket yet.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Team</th>
                    {t.bracketsEnabled && <th className="px-4 py-3">Bracket</th>}
                    <th className="px-4 py-3">Avg Power</th>
                    <th className="px-4 py-3">W / L</th>
                    <th className="px-4 py-3">Win %</th>
                    <th className="px-4 py-3 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredTeams.map((tm, idx) => (
                    <tr
                      key={tm.id}
                      className="transition hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 font-mono font-extrabold text-indigo-300">
                        #{idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-extrabold text-white">
                          {tm.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {tm.memberIds.length} member
                          {tm.memberIds.length === 1 ? "" : "s"}
                        </div>
                      </td>
                      {t.bracketsEnabled && (
                        <td className="px-4 py-3 text-slate-300">
                          {tm.bracketName || "Unassigned"}
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {tm.verifiedPower > 0 ? `${tm.verifiedPower} SP` : "—"}
                      </td>
                      <td className="px-4 py-3 font-bold text-white">
                        <span className="text-emerald-400">{tm.wins}W</span> /{" "}
                        <span className="text-rose-400">{tm.losses}L</span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {tm.winRate}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-extrabold text-indigo-300">
                        {tm.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : filteredRegs.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400">
              No registered players in this bracket yet.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Player</th>
                  {t.bracketsEnabled && <th className="px-4 py-3">Bracket</th>}
                  <th className="px-4 py-3">Verified SP</th>
                  <th className="px-4 py-3">W / L</th>
                  <th className="px-4 py-3">Win %</th>
                  <th className="px-4 py-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredRegs.map((r, idx) => (
                  <tr key={r.id} className="transition hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-extrabold text-indigo-300">
                      #{idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-extrabold text-white">
                        {r.inGameId ||
                          r.discordDisplayName ||
                          r.discordUsername ||
                          `Player #${r.userId.slice(-4)}`}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {r.discordUsername ? `@${r.discordUsername} · ` : ""}
                        {r.userId}
                      </div>
                    </td>
                    {t.bracketsEnabled && (
                      <td className="px-4 py-3 text-slate-300">
                        {r.bracketName || "Unassigned"}
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {r.verifiedSquadPower !== null
                        ? `${r.verifiedSquadPower} SP`
                        : "Pending"}
                    </td>
                    <td className="px-4 py-3 font-bold text-white">
                      <span className="text-emerald-400">{r.wins}W</span> /{" "}
                      <span className="text-rose-400">{r.losses}L</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{r.winRate}%</td>
                    <td className="px-4 py-3 text-right font-mono font-extrabold text-indigo-300">
                      {r.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Result Declaration Studio Modal */}
      {declareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setDeclareOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90dvh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-3xl border border-slate-700 bg-[#0b1120] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-300">
                  <Crown className="h-3 w-3" /> Result Declaration Studio
                </div>
                <h2 className="mt-2 text-lg font-black text-white">
                  Declare Final Winners &amp; Freeze Standings
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Confirming locks the leaderboard permanently, publishes the
                  official podium announcement in Discord, and assigns
                  configured Discord award roles via WebSync.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeclareOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {unresolvedCount > 0 && (
              <div className="space-y-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200">
                <div className="flex items-center gap-2 font-extrabold text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {unresolvedCount} unresolved match
                  {unresolvedCount === 1 ? "" : "es"} still active
                </div>
                <p>
                  Resolve all matches first for clean final rankings, or enable
                  Force Declare below to freeze standings immediately.
                </p>
                <label className="flex cursor-pointer items-center gap-2 font-bold text-white">
                  <input
                    type="checkbox"
                    checked={forceDeclare}
                    onChange={(e) => setForceDeclare(e.target.checked)}
                    className="h-4 w-4 accent-indigo-500"
                  />
                  Force declare results with {unresolvedCount} unresolved match(es)
                </label>
              </div>
            )}

            {/* Preview Computed Podium */}
            <div className="space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Podium Preview (Top 3 per Bracket)
              </div>
              {previewPodiums.map((grp) => (
                <div
                  key={grp.bracket}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                >
                  <div className="mb-2.5 text-xs font-extrabold text-indigo-300">
                    {grp.bracket}
                  </div>
                  {grp.winners.length === 0 ? (
                    <div className="text-xs text-slate-500">
                      No eligible placements found.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {grp.winners.map((w) => {
                        const prize =
                          w.place === 1
                            ? t.prizeDescriptions.first
                            : w.place === 2
                              ? t.prizeDescriptions.second
                              : t.prizeDescriptions.third;
                        const roleId =
                          w.place === 1
                            ? t.awardRoleIds?.first
                            : w.place === 2
                              ? t.awardRoleIds?.second
                              : t.awardRoleIds?.third;
                        return (
                          <div
                            key={w.place}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-amber-400">
                                #{w.place}
                              </span>
                              <strong className="text-white">{w.label}</strong>
                              <span className="text-[11px] text-slate-400">
                                ({w.wins}W/{w.losses}L · {w.points} pts)
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                              {prize && (
                                <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-bold text-amber-300">
                                  {prize}
                                </span>
                              )}
                              {roleId && (
                                <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 font-bold text-indigo-300">
                                  @{roleNameMap.get(roleId) || `Role ${roleId.slice(-5)}`}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeclareOpen(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || (unresolvedCount > 0 && !forceDeclare)}
                onClick={handleConfirmDeclare}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-extrabold text-white shadow-lg hover:bg-emerald-500 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {busy ? "Declaring Results..." : "Confirm & Announce Winners"}
              </button>
            </div>
          </div>
        </div>
      )}
          {postModalOpen && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setPostModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-3xl border border-slate-700 bg-[#0b1120] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Post Live Standings to Discord
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Publish the current{" "}
                  {selectedBracketName
                    ? `"${selectedBracketName}" bracket`
                    : "overall"}{" "}
                  leaderboard in clean Discord Markdown.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPostModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <DiscordChannelPicker
              channels={data.discordChannels || []}
              value={postChannelId}
              onChange={setPostChannelId}
              label="Target Discord Channel"
              emptyLabel="Use default tournament / leaderboard channel"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPostModalOpen(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const res = await runAction({
                    action: "post_standings",
                    announcementChannelId: postChannelId || null,
                    bracketName: selectedBracketName || undefined,
                  });
                  if (res.ok) setPostModalOpen(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-extrabold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {busy ? "Posting..." : "Post Standings"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

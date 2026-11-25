"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Crown,
  Layers,
  MapPin,
  Megaphone,
  Send,
  ShieldCheck,
  Swords,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { DiscordChannelPicker } from "@/components/DiscordRolePicker";
import { useTournamentDetail } from "@/components/TournamentDetailContext";
import { FORMAT_LABELS, SCORING_LABELS } from "@/lib/tournament-types";

export default function TournamentOverviewPage() {
  const { guildId, data, busy, runAction } = useTournamentDetail();
  const [announceMsg, setAnnounceMsg] = useState("");
  const [announceChan, setAnnounceChan] = useState("");

  if (!data) return null;
  const { tournament: t, access, myRegistration, matches, discordChannels } =
    data;

  const base = `/servers/${guildId}/tournaments/${t.id}`;
  const myNextMatch = myRegistration
    ? matches.find(
        (m) =>
          !["approved", "forfeited", "cancelled"].includes(m.status) &&
          (m.sideAUserIds.includes(myRegistration.userId) ||
            m.sideBUserIds.includes(myRegistration.userId))
      ) || null
    : null;

  async function handleSendAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!announceMsg.trim()) return;
    const res = await runAction(
      {
        action: "send_announcement",
        announcementMessage: announceMsg.trim(),
        announcementChannelId:
          announceChan || t.announcementChannelId || null,
      },
      "Announcement queued! SSE Tournament Bot will post it in Discord shortly."
    );
    if (res.ok) setAnnounceMsg("");
  }

  return (
    <div className="space-y-6">
      {/* KPI Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          href={`${base}/players`}
          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-indigo-500/60"
        >
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Participants</span>
            <Users className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-white">
            {t.counts.registrations}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            {t.mode === "team"
              ? `${t.counts.teams} active teams`
              : t.counts.pendingPower > 0
                ? `${t.counts.pendingPower} SP pending`
                : "All SP checked"}
          </div>
        </Link>

        <Link
          href={`${base}/matches`}
          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-indigo-500/60"
        >
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Matches</span>
            <Swords className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-white">
            {t.counts.matches}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            {t.counts.pendingReview + t.counts.disputed > 0
              ? `${t.counts.pendingReview} review · ${t.counts.disputed} disputed`
              : "Up to date"}
          </div>
        </Link>

        <Link
          href={`${base}/standings`}
          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-indigo-500/60"
        >
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Scoring</span>
            <Trophy className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-1.5 truncate text-lg font-black text-white">
            {SCORING_LABELS[t.scoring]}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            {t.standingsFrozen ? "Final standings frozen" : "Live standings"}
          </div>
        </Link>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>SP Brackets</span>
            <Layers className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-white">
            {t.bracketsEnabled ? t.brackets.length : "Open"}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            {t.bracketsEnabled ? "Tiered matchmaking" : "Single open division"}
          </div>
        </div>
      </div>

      {/* Personalized Member Self-Service Status Card */}
      <section className="rounded-3xl border border-indigo-500/35 bg-indigo-500/10 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
            <UserCheck className="h-4 w-4 text-indigo-400" />
            Your Tournament Status
          </h2>
          {myRegistration && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                myRegistration.squadPowerStatus === "approved"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : myRegistration.squadPowerStatus === "rejected"
                    ? "bg-rose-500/20 text-rose-300"
                    : "bg-amber-500/20 text-amber-300"
              }`}
            >
              SP {myRegistration.squadPowerStatus}
            </span>
          )}
        </div>

        {myRegistration ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                <span className="block text-[10px] text-slate-400">
                  Verified Power
                </span>
                <strong className="mt-0.5 block text-sm text-white">
                  {myRegistration.verifiedSquadPower !== null
                    ? `${myRegistration.verifiedSquadPower} SP`
                    : myRegistration.claimedSquadPower !== null
                      ? `${myRegistration.claimedSquadPower} SP (pending)`
                      : "Pending"}
                </strong>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                <span className="block text-[10px] text-slate-400">
                  Bracket / Team
                </span>
                <strong className="mt-0.5 block truncate text-sm text-white">
                  {myRegistration.teamName ||
                    myRegistration.bracketName ||
                    "Open Division"}
                </strong>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                <span className="block text-[10px] text-slate-400">
                  Record
                </span>
                <strong className="mt-0.5 block text-sm text-white">
                  {myRegistration.wins}W / {myRegistration.losses}L ·{" "}
                  {myRegistration.points} pts
                </strong>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                <span className="block text-[10px] text-slate-400">
                  Next Match
                </span>
                <strong className="mt-0.5 block truncate text-sm text-indigo-300">
                  {myNextMatch
                    ? `Match #${String(myNextMatch.matchNumber).padStart(3, "0")}`
                    : "None active"}
                </strong>
              </div>
            </div>

            {myNextMatch && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/75 px-4 py-3 text-xs">
                <div>
                  <span className="font-bold text-white">
                    {myNextMatch.sideALabel} vs {myNextMatch.sideBLabel}
                  </span>
                  <span className="ml-2 text-slate-400">
                    · Map: {myNextMatch.mapName}
                  </span>
                </div>
                <CopyButton
                  value={`/match submit match_id:${myNextMatch.id}`}
                  label="Copy /match submit"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
            <p className="max-w-xl leading-relaxed">
              {t.status === "registration"
                ? "Registration is currently OPEN! Join this tournament in Discord with your squad-power screenshot proof."
                : `You are not registered as a player in this tournament (current status: ${t.status.replace("_", " ")}).`}
            </p>
            {t.status === "registration" && (
              <CopyButton
                value={`/register tournament_id:${t.id}`}
                label="Copy /register Command"
              />
            )}
          </div>
        )}
      </section>

      {/* Main Details & Rules Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Description & Rules */}
          <section className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-sm font-extrabold text-white">
              Rules &amp; Tournament Details
            </h2>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
              {t.description ||
                `Official ${t.gameName} ${FORMAT_LABELS[t.format]} tournament managed via SSE Tournament Bot.`}
            </p>

            <div className="grid grid-cols-2 gap-2.5 border-t border-slate-800/80 pt-4 text-xs sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="block text-[10px] text-slate-400">Proof Policy</span>
                <strong className="text-white">
                  {t.resultPolicy.proofRequired ? "Screenshot Required" : "Optional"}
                </strong>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="block text-[10px] text-slate-400">Approval</span>
                <strong className="text-white">
                  {t.resultPolicy.approvalRequired ? "Staff Verified" : "Auto-Approved"}
                </strong>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="block text-[10px] text-slate-400">Draws</span>
                <strong className="text-white">
                  {t.resultPolicy.allowDraws ? "Allowed (+1 pt)" : "Not Allowed"}
                </strong>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="block text-[10px] text-slate-400">Deadline</span>
                <strong className="inline-flex items-center gap-1 text-white">
                  <Clock className="h-3 w-3 text-indigo-400" />
                  {t.schedule.matchDeadlineHours || 48}h
                </strong>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="block text-[10px] text-slate-400">Match Duration</span>
                <strong className="text-white">
                  {t.schedule.matchDurationMinutes || 60} mins
                </strong>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="block text-[10px] text-slate-400">Settings Lock</span>
                <strong className="text-white">
                  {t.settingsLocked ? "Locked (Live)" : "Editable"}
                </strong>
              </div>
            </div>

            {(t.schedule.startAt || t.schedule.endAt) && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-300">
                <Calendar className="h-4 w-4 text-indigo-400" />
                {t.schedule.startAt && (
                  <span>
                    Starts:{" "}
                    <strong className="text-white">
                      {new Date(t.schedule.startAt).toLocaleString("en-IN")}
                    </strong>
                  </span>
                )}
                {t.schedule.endAt && (
                  <span>
                    · Ends:{" "}
                    <strong className="text-white">
                      {new Date(t.schedule.endAt).toLocaleString("en-IN")}
                    </strong>
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Staff: Post Discord Announcement */}
          {access.canManageTournament && (
            <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
                  <Megaphone className="h-4 w-4 text-amber-400" />
                  Post Discord Announcement
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Sends a formatted embed directly into your Discord server via
                  SSE Bot WebSync (~15s).
                </p>
              </div>
              <form onSubmit={handleSendAnnouncement} className="space-y-3">
                <textarea
                  rows={3}
                  required
                  minLength={2}
                  maxLength={3800}
                  value={announceMsg}
                  onChange={(e) => setAnnounceMsg(e.target.value)}
                  placeholder="Write an announcement for players (e.g., Round 2 starts at 8 PM IST — submit screenshots inside your match room!)..."
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <DiscordChannelPicker
                      channels={discordChannels}
                      value={announceChan || t.announcementChannelId || ""}
                      onChange={setAnnounceChan}
                      label="Destination Channel"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy || announceMsg.trim().length < 2}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-indigo-500 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send to Discord
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>

        {/* Right Column: Prizes, Brackets & Maps */}
        <div className="space-y-5">
          {/* Podium Prizes */}
          <section className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
              <Crown className="h-4 w-4 text-amber-400" />
              Podium Prizes
            </h2>
            {t.prizeDescriptions.first ||
            t.prizeDescriptions.second ||
            t.prizeDescriptions.third ? (
              <div className="space-y-2 text-xs">
                {t.prizeDescriptions.first && (
                  <div className="flex items-center justify-between rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5">
                    <span className="font-extrabold text-amber-300">1st Place</span>
                    <span className="font-bold text-white">
                      {t.prizeDescriptions.first}
                    </span>
                  </div>
                )}
                {t.prizeDescriptions.second && (
                  <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-2.5">
                    <span className="font-bold text-slate-300">2nd Place</span>
                    <span className="font-semibold text-white">
                      {t.prizeDescriptions.second}
                    </span>
                  </div>
                )}
                {t.prizeDescriptions.third && (
                  <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-3.5 py-2.5">
                    <span className="font-bold text-slate-400">3rd Place</span>
                    <span className="font-semibold text-white">
                      {t.prizeDescriptions.third}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                No prize pool configured yet.
              </p>
            )}
          </section>

          {/* SP Brackets */}
          {t.bracketsEnabled && (
            <section className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
                  <Layers className="h-4 w-4 text-indigo-400" />
                  Power Brackets ({t.brackets.length})
                </h2>
                {access.canManageTournament && !t.settingsLocked && (
                  <Link
                    href={`${base}/settings`}
                    className="text-[11px] font-bold text-indigo-400 hover:underline"
                  >
                    Edit
                  </Link>
                )}
              </div>
              {t.brackets.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Add SP brackets in Settings before opening registration.
                </p>
              ) : (
                <div className="space-y-2">
                  {t.brackets.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-2.5 text-xs"
                    >
                      <span className="font-bold text-white">{b.name}</span>
                      <span className="font-mono text-[11px] text-indigo-300">
                        {b.minPower} – {b.maxPower ?? "∞"} SP
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Map Pool */}
          <section className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
              <MapPin className="h-4 w-4 text-emerald-400" />
              Map Pool ({t.maps.length})
            </h2>
            {t.maps.length === 0 ? (
              <p className="text-xs text-slate-400">
                Maps will be announced per match.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {t.maps.map((m) => (
                  <span
                    key={m}
                    className="rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1 text-[11px] font-bold text-slate-200"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Staff Quick Jump */}
          {(access.canManageTournament || access.canAssignModerators) && (
            <Link
              href={`${base}/settings`}
              className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs font-bold text-white transition hover:border-indigo-500/60"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
                {access.canAssignModerators
                  ? "Manage Moderator Roles & Settings"
                  : "Tournament Settings & Rules"}
              </span>
              <ArrowRight className="h-4 w-4 text-indigo-400" />
            </Link>
          )}
        </div>
      </div>

      {/* Quick Verification Footnote */}
      <div className="flex flex-wrap items-center gap-4 border-t border-slate-800/80 pt-3 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Two-way
          MongoDB sync with SSE Tournament Bot
        </span>
        <Link
          href={`${base}/standings`}
          className="font-bold text-indigo-400 hover:underline"
        >
          View Standings &amp; Results →
        </Link>
      </div>
    </div>
  );
}

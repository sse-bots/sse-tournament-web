"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  Sliders,
  UserPlus,
  Users,
  Swords,
  ShieldCheck,
  BarChart3,
  Gamepad2,
  ArrowLeft,
  Calendar,
  MapPin,
} from "lucide-react";
import { TournamentDTO, RegistrationDTO, TeamDTO, MatchDTO } from "@/lib/types";
import { TournamentStatusBadge, FormatBadge } from "@/components/ui/badges";
import { SetupPublishPanel } from "@/components/tournament/setup-publish-panel";
import { RegistrationPanel } from "@/components/tournament/registration-panel";
import { TeamsPanel } from "@/components/tournament/teams-panel";
import { BracketVisualizer } from "@/components/tournament/bracket-visualizer";
import { ApprovalsPanel } from "@/components/tournament/approvals-panel";
import { LeaderboardPanel } from "@/components/tournament/leaderboard-panel";

type TabKey = "overview" | "setup" | "register" | "teams" | "matches" | "approvals" | "leaderboard";

interface PermState {
  canManage: boolean;
  manageReason: string | null;
  suspendedByParticipation: boolean;
  canReview: boolean;
  isBotAdmin: boolean;
  discordId: string | null;
}

function TournamentDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;

  const [tab, setTab] = useState<TabKey>((searchParams.get("tab") as TabKey) || "overview");
  const [tournament, setTournament] = useState<TournamentDTO | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationDTO[]>([]);
  const [teams, setTeams] = useState<TeamDTO[]>([]);
  const [matches, setMatches] = useState<MatchDTO[]>([]);
  const [perms, setPerms] = useState<PermState>({
    canManage: false,
    manageReason: null,
    suspendedByParticipation: false,
    canReview: false,
    isBotAdmin: false,
    discordId: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load tournament");
      setTournament(data.tournament);
      setRegistrations(data.registrations || []);
      setTeams(data.teams || []);
      setMatches(data.matches || []);
      setPerms(data.permissions);
      setError(null);
      if (data.tournament.status === "draft" && !searchParams.get("tab") && data.permissions?.canManage) {
        setTab("setup");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, searchParams]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-[var(--arena-muted)]">
        Loading tournament arena...
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-3">
        <div className="text-red-500 font-bold">{error || "Tournament not found."}</div>
        <Link href="/" className="arena-btn-secondary">Back to Arena</Link>
      </div>
    );
  }

  const pendingApprovals =
    registrations.filter((r) => r.status === "registered" && r.squadPowerStatus === "pending").length +
    matches.filter((m) => m.status === "pending_review" || m.status === "disputed").length;

  const tabs: Array<{
    key: TabKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    hide?: boolean;
  }> = [
    { key: "overview", label: "Overview", icon: Trophy },
    { key: "setup", label: "Setup & Publish", icon: Sliders, hide: !perms.canManage },
    { key: "register", label: "Registration", icon: UserPlus, badge: registrations.filter((r) => r.status === "registered").length },
    { key: "teams", label: "Teams HQ", icon: Users, badge: teams.filter((t) => t.status === "active").length, hide: tournament.mode !== "team" },
    { key: "matches", label: "Brackets & Matches", icon: Swords, badge: matches.length },
    { key: "approvals", label: "Approvals", icon: ShieldCheck, badge: pendingApprovals },
    { key: "leaderboard", label: "Leaderboard", icon: BarChart3 },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
      <div className="arena-card overflow-hidden shadow-arena">
        <div className="bg-gradient-to-r from-amber-500/15 via-[var(--arena-surface)] to-cyan-500/10 p-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--arena-muted)] hover:text-amber-500 mb-3">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Arena
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-cyan-500">
                  <Gamepad2 className="h-4 w-4" /> {tournament.gameName}
                </span>
                <TournamentStatusBadge status={tournament.status} />
                <FormatBadge format={tournament.format} />
                <span className="rounded-md border border-[var(--arena-border)] bg-[var(--arena-elevated)] px-2 py-0.5 text-[11px] font-semibold uppercase">
                  {tournament.mode} • {tournament.scoring.replace(/_/g, " ")}
                </span>
              </div>
              <h1 className="font-display-caps text-2xl sm:text-4xl font-extrabold">{tournament.name}</h1>
              <p className="text-sm text-[var(--arena-muted)] max-w-3xl">
                {tournament.description || "Official SSE competitive tournament."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
              {tournament.status === "registration" && (
                <button type="button" onClick={() => setTab("register")} className="arena-btn-primary shadow-glowGold">
                  <UserPlus className="h-4 w-4" /> Register Now
                </button>
              )}
              {tournament.status === "draft" && perms.canManage && (
                <button type="button" onClick={() => setTab("setup")} className="arena-btn-primary shadow-glowGold">
                  <Sliders className="h-4 w-4" /> Finish Draft & Publish
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex overflow-x-auto border-t border-[var(--arena-border)] bg-[var(--arena-elevated)]/50 px-3">
          {tabs.filter((t) => !t.hide).map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                  active
                    ? "border-amber-500 text-amber-500"
                    : "border-transparent text-[var(--arena-muted)] hover:text-[var(--arena-text)]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-500">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="arena-card p-5 space-y-4">
              <h3 className="font-display-caps text-base font-bold">Format & Rules Summary</h3>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-lg bg-[var(--arena-elevated)] p-3">
                  <div className="text-[11px] font-bold uppercase text-[var(--arena-muted)]">Match Proof Policy</div>
                  <div className="font-semibold mt-1">
                    {tournament.resultPolicy?.proofRequired ? "Screenshot Required" : "Proof Optional"} •{" "}
                    {tournament.resultPolicy?.approvalRequired ? "Manager Review Required" : "Auto-Approved"}
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--arena-elevated)] p-3">
                  <div className="text-[11px] font-bold uppercase text-[var(--arena-muted)]">Schedule & Deadlines</div>
                  <div className="font-semibold mt-1 flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-cyan-500" />
                    {tournament.schedule?.matchDeadlineHours || 48}h reporting deadline •{" "}
                    {tournament.schedule?.matchDurationMinutes || 60}m slots
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--arena-elevated)] p-3 sm:col-span-2">
                  <div className="text-[11px] font-bold uppercase text-[var(--arena-muted)] flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-amber-500" /> Map Pool
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {tournament.maps.length ? (
                      tournament.maps.map((m) => (
                        <span key={m} className="rounded-md border border-[var(--arena-border)] bg-[var(--arena-surface)] px-2.5 py-1 text-xs font-semibold">
                          {m}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[var(--arena-muted)]">To be announced by managers</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {tournament.bracketsEnabled && (
              <div className="arena-card p-5 space-y-3">
                <h3 className="font-display-caps text-base font-bold">Squad-Power Brackets</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {tournament.brackets.map((b) => (
                    <div key={b._id} className="rounded-xl border border-[var(--arena-border)] bg-[var(--arena-elevated)] p-3.5">
                      <div className="font-bold">{b.name}</div>
                      <div className="font-mono text-xs text-cyan-500 mt-0.5">
                        {b.minPower.toLocaleString()} – {b.maxPower !== null ? b.maxPower.toLocaleString() : "∞"} SP
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="arena-card p-5 space-y-3">
              <h3 className="font-display-caps text-base font-bold text-amber-500">Championship Prizes</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                  <span className="font-bold text-amber-500">1st Place</span>
                  <span className="font-semibold">{tournament.prizeDescriptions?.first || "Champion Title"}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-[var(--arena-elevated)] px-3 py-2">
                  <span className="font-bold text-slate-400">2nd Place</span>
                  <span>{tournament.prizeDescriptions?.second || "Runner-Up"}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-[var(--arena-elevated)] px-3 py-2">
                  <span className="font-bold text-orange-400">3rd Place</span>
                  <span>{tournament.prizeDescriptions?.third || "Third Place"}</span>
                </div>
              </div>
            </div>

            <div className="arena-card p-5 space-y-2 text-xs text-[var(--arena-muted)]">
              <div className="font-display-caps text-sm font-bold text-[var(--arena-text)]">Discord Sync Details</div>
              <div className="font-mono">Tournament ID: {tournament._id}</div>
              <div className="font-mono">Guild ID: {tournament.guildId}</div>
              <div className="font-mono">Owner ID: {tournament.ownerId}</div>
            </div>
          </div>
        </div>
      )}

      {tab === "setup" && <SetupPublishPanel tournament={tournament} canManage={perms.canManage} onRefresh={loadAll} />}
      {tab === "register" && <RegistrationPanel tournament={tournament} registrations={registrations} discordId={perms.discordId} canManage={perms.canManage} onRefresh={loadAll} />}
      {tab === "teams" && <TeamsPanel tournament={tournament} teams={teams} registrations={registrations} discordId={perms.discordId} canManage={perms.canManage} onRefresh={loadAll} />}
      {tab === "matches" && <BracketVisualizer tournament={tournament} matches={matches} registrations={registrations} teams={teams} canManage={perms.canManage} onRefresh={loadAll} />}
      {tab === "approvals" && <ApprovalsPanel tournament={tournament} registrations={registrations} matches={matches} canManage={perms.canManage} canReview={perms.canReview} suspendedByParticipation={perms.suspendedByParticipation} onRefresh={loadAll} />}
      {tab === "leaderboard" && <LeaderboardPanel tournament={tournament} />}
    </div>
  );
}

export default function TournamentDetailPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-[var(--arena-muted)]">Loading tournament...</div>}>
      <TournamentDetailContent />
    </Suspense>
  );
}

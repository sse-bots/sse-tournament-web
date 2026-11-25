"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  Crown,
  Download,
  Gamepad2,
  Layers,
  MapPin,
  Settings,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { BracketBoard } from "@/components/BracketBoard";
import { CopyButton } from "@/components/CopyButton";
import {
  FORMAT_LABELS,
  SCORING_LABELS,
  STATUS_META,
  type MatchRow,
  type RegistrationRow,
  type TeamRow,
  type TournamentSummary,
} from "@/lib/tournament-types";

interface DetailPayload {
  tournament: TournamentSummary;
  registrations: RegistrationRow[];
  teams: TeamRow[];
  matches: MatchRow[];
  canManage: boolean;
}

export default function TournamentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "";

  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "bracket" | "standings" | "roster">("bracket");
  const [bracketFilter, setBracketFilter] = useState<string>("all");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tournaments/${encodeURIComponent(id)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Tournament not found.");
        return;
      }
      setData(j);
      if ((j.matches || []).length === 0) setTab("overview");
    } catch {
      setError("Could not load tournament details.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRegistrations = useMemo(() => {
    if (!data) return [];
    const active = data.registrations.filter((r) => r.status === "registered");
    return bracketFilter === "all" ? active : active.filter((r) => r.bracketId === bracketFilter);
  }, [data, bracketFilter]);

  const filteredTeams = useMemo(() => {
    if (!data) return [];
    const active = data.teams.filter((t) => t.status === "active");
    return bracketFilter === "all" ? active : active.filter((t) => t.bracketId === bracketFilter);
  }, [data, bracketFilter]);

  if (loading) {
    return (
      <div className="space-y-4 py-6">
        <div className="h-44 animate-pulse rounded-3xl bg-slate-900/70" />
        <div className="h-72 animate-pulse rounded-3xl bg-slate-900/60" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <Trophy className="mx-auto mb-3 h-10 w-10 text-rose-400" />
        <h1 className="text-lg font-bold text-white">Tournament Unavailable</h1>
        <p className="mt-1.5 text-xs text-slate-400">{error || "Not found."}</p>
        <Link href="/tournaments" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Arenas
        </Link>
      </div>
    );
  }

  const { tournament: t, matches, canManage } = data;
  const st = STATUS_META[t.status] || STATUS_META.draft;
  const hasPrizes = t.prizeDescriptions.first || t.prizeDescriptions.second || t.prizeDescriptions.third;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/tournaments" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> All Tournaments
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton value={t.id} label="Copy Bot ID" />
          <a href={`/api/tournaments/${encodeURIComponent(t.id)}/export`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-indigo-500 hover:text-white">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </a>
          {canManage && (
            <Link href={`/dashboard/tournaments/${t.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-500">
              <Settings className="h-3.5 w-3.5" /> Manage Event
            </Link>
          )}
        </div>
      </div>

      <section className="sse-arena-hero overflow-hidden rounded-3xl border border-slate-800 p-6 shadow-2xl sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs font-bold text-slate-200">
            <Gamepad2 className="h-3.5 w-3.5 text-indigo-400" /> {t.gameName}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider" style={{ backgroundColor: st.bg, color: st.color }}>
            {st.pulse && <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: st.color }} />}
            {st.label}
          </span>
          <span className="rounded-full border border-slate-700/80 bg-slate-950/60 px-2.5 py-1 font-mono text-[10px] text-slate-400">ID: {t.id}</span>
        </div>

        <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-4xl">{t.name}</h1>
        {t.description && <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-300 sm:text-sm">{t.description}</p>}

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-[10px] font-bold uppercase text-slate-400">Format</div>
            <div className="mt-1 text-xs font-extrabold text-white">{FORMAT_LABELS[t.format]}{t.format === "series" ? ` (Bo${t.seriesBestOf})` : ""}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-[10px] font-bold uppercase text-slate-400">Mode &amp; Scoring</div>
            <div className="mt-1 text-xs font-extrabold capitalize text-white">{t.mode} · {SCORING_LABELS[t.scoring]}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-[10px] font-bold uppercase text-slate-400">Participants</div>
            <div className="mt-1 text-xs font-extrabold text-white">{t.counts.registrations} players{t.mode === "team" ? ` · ${t.counts.teams} teams` : ""}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-[10px] font-bold uppercase text-slate-400">Matches</div>
            <div className="mt-1 text-xs font-extrabold text-white">{t.counts.matches} total{t.bracketsEnabled ? ` · ${t.brackets.length} brackets` : ""}</div>
          </div>
        </div>

        {hasPrizes && (
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {t.prizeDescriptions.first && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5">
                <Crown className="h-4 w-4 shrink-0 text-amber-400" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-amber-300">1st Place Prize</div>
                  <div className="truncate text-xs font-extrabold text-white">{t.prizeDescriptions.first}</div>
                </div>
              </div>
            )}
            {t.prizeDescriptions.second && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-slate-600/50 bg-slate-800/60 px-4 py-2.5">
                <Award className="h-4 w-4 shrink-0 text-slate-300" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-slate-400">2nd Place Prize</div>
                  <div className="truncate text-xs font-extrabold text-white">{t.prizeDescriptions.second}</div>
                </div>
              </div>
            )}
            {t.prizeDescriptions.third && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-orange-500/40 bg-orange-500/10 px-4 py-2.5">
                <Award className="h-4 w-4 shrink-0 text-orange-400" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-orange-300">3rd Place Prize</div>
                  <div className="truncate text-xs font-extrabold text-white">{t.prizeDescriptions.third}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <nav className="no-scrollbar flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70 p-1.5">
        {([
          { id: "overview", label: "Overview & Rules", icon: ShieldCheck },
          { id: "bracket", label: `Matches (${matches.length})`, icon: Swords },
          { id: "standings", label: "Standings", icon: Trophy },
          { id: "roster", label: t.mode === "team" ? `Teams & Players (${t.counts.teams})` : `Players (${t.counts.registrations})`, icon: Users },
        ] as const).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition ${tab === item.id ? "bg-indigo-600 text-white shadow-md" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
            >
              <Icon className="h-3.5 w-3.5" /> {item.label}
            </button>
          );
        })}
      </nav>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-white"><ShieldCheck className="h-4 w-4 text-indigo-400" /> Rules &amp; Result Policy</h2>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5"><span>Screenshot Proof Required</span><span className="font-bold text-white">{t.resultPolicy.proofRequired ? "Yes (Mandatory)" : "Optional"}</span></li>
              <li className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5"><span>Manager Proof Approval</span><span className="font-bold text-white">{t.resultPolicy.approvalRequired ? "Required" : "Auto-Approved"}</span></li>
              <li className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5"><span>Draws Allowed</span><span className="font-bold text-white">{t.resultPolicy.allowDraws ? "Yes (+1 pt)" : "No"}</span></li>
              <li className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5"><span>Tie-Breaker Order</span><span className="font-mono text-[11px] text-indigo-300">{t.tieBreakers.join(" -> ")}</span></li>
              <li className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5"><span>Reporting Deadline</span><span className="inline-flex items-center gap-1 font-bold text-white"><Clock className="h-3.5 w-3.5 text-amber-400" /> {t.schedule.matchDeadlineHours || 48} hours</span></li>
            </ul>
            {t.status === "registration" && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300">
                <div className="font-bold text-white">How to Join in Discord</div>
                <p className="mt-1">Run <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-[11px] text-emerald-300">/register tournament_id:{t.id}</code> with your squad power values and screenshot proof.</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="flex items-center gap-2 text-base font-bold text-white"><Layers className="h-4 w-4 text-amber-400" /> Squad-Power Brackets</h2>
              {!t.bracketsEnabled ? (
                <p className="text-xs text-slate-400">Power brackets are disabled — unified division.</p>
              ) : t.brackets.length === 0 ? (
                <p className="text-xs text-slate-400">Brackets enabled; none added yet.</p>
              ) : (
                <div className="space-y-2">
                  {t.brackets.map((b) => (
                    <div key={b.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-xs">
                      <span className="font-bold text-white">{b.name}</span>
                      <span className="rounded-full bg-amber-500/15 px-3 py-0.5 font-mono text-[11px] font-bold text-amber-300">{b.minPower} – {b.maxPower ?? "∞"} SP</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="flex items-center gap-2 text-base font-bold text-white"><MapPin className="h-4 w-4 text-emerald-400" /> Map Rotation Pool</h2>
              {t.maps.length === 0 ? (
                <p className="text-xs text-slate-400">Maps will be announced per match.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {t.maps.map((m) => <span key={m} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200">{m}</span>)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "bracket" && <BracketBoard matches={matches} brackets={t.brackets} />}

      {tab === "standings" && (
        <div className="space-y-5">
          {t.standingsFrozen && t.finalStandings.length > 0 && (
            <section className="space-y-3 rounded-3xl border border-amber-500/40 bg-amber-500/10 p-5">
              <div className="flex items-center gap-2 text-sm font-extrabold text-amber-300"><Crown className="h-4 w-4" /> Official Frozen Final Podium</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {t.finalStandings.map((row, i) => (
                  <div key={`${row.bracket}-${row.place}-${i}`} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-extrabold text-amber-300">#{row.place} · {row.bracket}</span>
                      <span className="font-mono text-slate-400">{row.wins}W / {row.losses}L</span>
                    </div>
                    <div className="mt-1.5 text-sm font-extrabold text-white">{row.teamName || `Player #${(row.userId || "").slice(-4)}`}</div>
                    <div className="mt-0.5 text-xs font-semibold text-indigo-300">{row.points} pts</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {t.brackets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setBracketFilter("all")} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${bracketFilter === "all" ? "bg-indigo-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-300"}`}>All Brackets</button>
              {t.brackets.map((b) => (
                <button key={b.id} type="button" onClick={() => setBracketFilter(b.id)} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${bracketFilter === b.id ? "bg-indigo-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-300"}`}>{b.name}</button>
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/70 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">{t.mode === "team" ? "Team" : "Player"}</th>
                  {t.bracketsEnabled && <th className="px-4 py-3">Bracket</th>}
                  <th className="px-4 py-3">W / L</th>
                  <th className="px-4 py-3">Win %</th>
                  <th className="px-4 py-3">Points</th>
                  <th className="px-4 py-3">Verified SP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {t.mode === "team" ? (
                  filteredTeams.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No active teams ranked yet.</td></tr>
                  ) : (
                    filteredTeams.map((tm, idx) => (
                      <tr key={tm.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-extrabold text-indigo-400">#{idx + 1}</td>
                        <td className="px-4 py-3 font-bold text-white">{tm.name} <span className="text-[10px] font-normal text-slate-400">({tm.memberIds.length} members)</span></td>
                        {t.bracketsEnabled && <td className="px-4 py-3 text-slate-300">{tm.bracketName || "—"}</td>}
                        <td className="px-4 py-3 font-mono text-white">{tm.wins}W / {tm.losses}L</td>
                        <td className="px-4 py-3 font-mono text-emerald-400">{tm.winRate}%</td>
                        <td className="px-4 py-3 font-extrabold text-white">{tm.points}</td>
                        <td className="px-4 py-3 font-mono text-amber-300">{tm.verifiedPower || "—"}</td>
                      </tr>
                    ))
                  )
                ) : filteredRegistrations.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No registered players yet.</td></tr>
                ) : (
                  filteredRegistrations.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-extrabold text-indigo-400">#{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">{r.inGameId || `Player #${r.userId.slice(-4)}`}</div>
                        <div className="font-mono text-[10px] text-slate-500">Discord ID: {r.userId}</div>
                      </td>
                      {t.bracketsEnabled && <td className="px-4 py-3 text-slate-300">{r.bracketName || "Pending"}</td>}
                      <td className="px-4 py-3 font-mono text-white">{r.wins}W / {r.losses}L</td>
                      <td className="px-4 py-3 font-mono text-emerald-400">{r.winRate}%</td>
                      <td className="px-4 py-3 font-extrabold text-white">{r.points}</td>
                      <td className="px-4 py-3 font-mono text-amber-300">{r.verifiedSquadPower !== null ? r.verifiedSquadPower : "Pending"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "roster" && (
        <div className="space-y-4">
          {t.mode === "team" && data.teams.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.teams.map((tm) => (
                <div key={tm.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-extrabold text-white">{tm.name}</span>
                    <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-300">{tm.status}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">Captain ID: <code className="font-mono text-slate-200">{tm.captainId}</code></div>
                  <div className="mt-1 text-xs text-slate-400">Members: {tm.memberIds.length}/{t.teamSizeMax} · Verified SP: {tm.verifiedPower || "Pending"}</div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.registrations.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-bold text-white">{r.inGameId || `Player #${r.userId.slice(-4)}`}</div>
                  <div className="font-mono text-[10px] text-slate-500">ID: {r.userId}</div>
                  {r.bracketName && <div className="mt-1 text-[10px] font-semibold text-amber-300">{r.bracketName}</div>}
                </div>
                <div className="shrink-0 text-right">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${r.squadPowerStatus === "approved" ? "bg-emerald-500/15 text-emerald-300" : r.squadPowerStatus === "rejected" ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300"}`}>
                    {r.squadPowerStatus === "approved" && <CheckCircle2 className="h-3 w-3" />}
                    {r.squadPowerStatus}
                  </span>
                  <div className="mt-1 font-mono text-[11px] text-slate-300">{r.verifiedSquadPower ?? r.claimedSquadPower ?? "—"} SP</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

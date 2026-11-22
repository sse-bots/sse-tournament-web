"use client";

import React, { useEffect, useState } from "react";
import { Trophy, Download, Lock, Medal } from "lucide-react";
import { TournamentDTO, RegistrationDTO } from "@/lib/types";

interface TeamStanding {
  _id: string;
  name: string;
  memberCount: number;
  power: number;
  wins: number;
  losses: number;
  points: number;
  pct: number;
}

export function LeaderboardPanel({ tournament }: { tournament: TournamentDTO }) {
  const [bracketId, setBracketId] = useState("");
  const [viewMode, setViewMode] = useState<"team" | "individual">(tournament.mode === "team" ? "team" : "individual");
  const [individuals, setIndividuals] = useState<RegistrationDTO[]>([]);
  const [teams, setTeams] = useState<TeamStanding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/tournaments/${tournament._id}/leaderboard${bracketId ? `?bracketId=${encodeURIComponent(bracketId)}` : ""}`);
        if (res.ok && mounted) {
          const data = await res.json();
          setIndividuals(data.individuals || []);
          setTeams(data.teams || []);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [tournament._id, bracketId]);

  const top3 = viewMode === "team"
    ? teams.slice(0, 3).map((t) => ({ name: t.name, sub: `${t.memberCount} players`, wins: t.wins, losses: t.losses, points: t.points }))
    : individuals.slice(0, 3).map((r) => ({ name: r.inGameId || r.displayName || r.userId, sub: `ID: ${r.userId}`, wins: r.wins, losses: r.losses, points: r.points }));

  const prizes = tournament.prizeDescriptions || {};
  const podiumMeta = [
    { rank: "1ST", color: "from-amber-400/25 to-amber-600/5 border-amber-500/50 text-amber-500", prize: prizes.first },
    { rank: "2ND", color: "from-slate-300/20 to-slate-500/5 border-slate-400/50 text-slate-400", prize: prizes.second },
    { rank: "3RD", color: "from-orange-500/20 to-orange-700/5 border-orange-500/40 text-orange-400", prize: prizes.third },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {tournament.bracketsEnabled && (
            <select className="arena-input w-auto text-xs font-semibold" value={bracketId} onChange={(e) => setBracketId(e.target.value)}>
              <option value="">All Brackets</option>
              {tournament.brackets.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          )}
          {tournament.mode === "team" && (
            <div className="inline-flex rounded-lg border border-[var(--arena-border)] bg-[var(--arena-surface)] p-0.5 text-xs font-bold">
              <button type="button" onClick={() => setViewMode("team")} className={`rounded-md px-3 py-1.5 ${viewMode === "team" ? "bg-amber-500 text-slate-950" : "text-[var(--arena-muted)]"}`}>Teams</button>
              <button type="button" onClick={() => setViewMode("individual")} className={`rounded-md px-3 py-1.5 ${viewMode === "individual" ? "bg-amber-500 text-slate-950" : "text-[var(--arena-muted)]"}`}>Individuals</button>
            </div>
          )}
          {tournament.standingsFrozen && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 px-3 py-1 text-xs font-bold text-amber-500">
              <Lock className="h-3.5 w-3.5" /> FINAL FROZEN STANDINGS
            </span>
          )}
        </div>
        <a href={`/api/tournaments/${tournament._id}/leaderboard?format=csv`} className="arena-btn-secondary text-xs py-1.5">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </a>
      </div>

      {top3.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {top3.map((entry, idx) => (
            <div key={idx} className={`rounded-2xl border bg-gradient-to-b p-5 shadow-arena ${podiumMeta[idx].color}`}>
              <div className="flex items-center justify-between">
                <span className="font-display-caps text-2xl font-extrabold">{podiumMeta[idx].rank}</span>
                {idx === 0 ? <Trophy className="h-7 w-7 text-amber-500" /> : <Medal className="h-6 w-6" />}
              </div>
              <div className="mt-3 font-display-caps text-xl font-bold text-[var(--arena-text)] truncate">{entry.name}</div>
              <div className="text-xs text-[var(--arena-muted)] font-mono">{entry.sub}</div>
              <div className="mt-4 flex items-center justify-between border-t border-[var(--arena-border)] pt-3 text-xs font-mono text-[var(--arena-text)]">
                <span><strong>{entry.wins}W</strong> – {entry.losses}L</span>
                <span className="font-bold text-amber-500">{entry.points} PTS</span>
              </div>
              {podiumMeta[idx].prize && <div className="mt-2 text-[11px] font-semibold text-emerald-500">Prize: {podiumMeta[idx].prize}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="arena-card overflow-hidden">
        <div className="border-b border-[var(--arena-border)] px-5 py-3 flex items-center justify-between">
          <h4 className="font-display-caps text-sm font-bold">Standings • {tournament.scoring.replace(/_/g, " ").toUpperCase()}</h4>
          <span className="font-mono text-[11px] text-[var(--arena-muted)]">Tie-breakers: {(tournament.tieBreakers || []).join(" → ")}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--arena-elevated)] text-[11px] uppercase tracking-wider text-[var(--arena-muted)]">
              <tr>
                <th className="px-4 py-3 w-14">Rank</th>
                <th className="px-4 py-3">{viewMode === "team" ? "Team" : "Player"}</th>
                <th className="px-4 py-3">W / L</th>
                <th className="px-4 py-3">Win %</th>
                <th className="px-4 py-3">Points</th>
                <th className="px-4 py-3 text-right">Verified SP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--arena-border)]">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--arena-muted)]">Loading leaderboard...</td></tr>
              ) : viewMode === "team" ? (
                teams.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--arena-muted)]">No ranked teams yet.</td></tr>
                ) : teams.map((tm, i) => (
                  <tr key={tm._id} className="hover:bg-[var(--arena-elevated)]/40">
                    <td className="px-4 py-3 font-display-caps font-bold text-amber-500">#{i + 1}</td>
                    <td className="px-4 py-3 font-bold">{tm.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{tm.wins}W – {tm.losses}L</td>
                    <td className="px-4 py-3 font-mono text-xs">{(tm.pct * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 font-mono font-bold text-cyan-500">{tm.points}</td>
                    <td className="px-4 py-3 font-mono text-xs text-right">{Math.round(tm.power).toLocaleString()}</td>
                  </tr>
                ))
              ) : individuals.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--arena-muted)]">No ranked competitors yet.</td></tr>
              ) : individuals.map((r, i) => {
                const total = r.wins + r.losses;
                return (
                  <tr key={r._id} className="hover:bg-[var(--arena-elevated)]/40">
                    <td className="px-4 py-3 font-display-caps font-bold text-amber-500">#{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold">{r.inGameId || r.displayName || r.userId}</div>
                      <div className="font-mono text-[10px] text-[var(--arena-muted)]">{r.userId}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.wins}W – {r.losses}L</td>
                    <td className="px-4 py-3 font-mono text-xs">{total ? ((100 * r.wins) / total).toFixed(1) : "0.0"}%</td>
                    <td className="px-4 py-3 font-mono font-bold text-cyan-500">{r.points}</td>
                    <td className="px-4 py-3 font-mono text-xs text-right">{r.verifiedSquadPower !== null ? r.verifiedSquadPower.toLocaleString() : "Pending"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

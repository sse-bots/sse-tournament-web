"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Swords, Sparkles, CalendarClock, RotateCcw, Plus, ExternalLink, MapPin, Hash, Eye } from "lucide-react";
import { TournamentDTO, MatchDTO, RegistrationDTO, TeamDTO } from "@/lib/types";
import { MatchStatusBadge } from "@/components/ui/badges";
import { useToast } from "@/components/ui/toast";

interface Props {
  tournament: TournamentDTO;
  matches: MatchDTO[];
  registrations: RegistrationDTO[];
  teams: TeamDTO[];
  canManage: boolean;
  onRefresh: () => Promise<void>;
}

export function BracketVisualizer({ tournament, matches, registrations, teams, canManage, onRefresh }: Props) {
  const { push } = useToast();
  const [selectedBracket, setSelectedBracket] = useState<string>("all");
  const [previewPairs, setPreviewPairs] = useState<Array<{ sideA: string; sideB: string; isBye: boolean }> | null>(null);
  const [busy, setBusy] = useState(false);

  const [showManual, setShowManual] = useState(false);
  const [sideA, setSideA] = useState("");
  const [sideB, setSideB] = useState("");
  const [mapName, setMapName] = useState("");
  const [schedAt, setSchedAt] = useState("");
  const [manualBracket, setManualBracket] = useState(tournament.brackets[0]?._id || "");

  const regMap = useMemo(() => new Map(registrations.map((r) => [r.userId, r])), [registrations]);

  function sideLabel(m: MatchDTO, side: "A" | "B"): string {
    const teamName = side === "A" ? m.sideATeamName : m.sideBTeamName;
    if (teamName) return teamName;
    const ids = side === "A" ? m.sideAUserIds : m.sideBUserIds;
    if (!ids.length) return m.isBye ? "BYE" : "TBD";
    return ids.map((uid) => { const r = regMap.get(uid); return r?.inGameId || r?.displayName || uid; }).join(", ");
  }

  const filtered = useMemo(() => {
    if (selectedBracket === "all") return matches;
    return matches.filter((m) => String(m.bracketId || "none") === selectedBracket);
  }, [matches, selectedBracket]);

  const rounds = useMemo(() => {
    const map = new Map<number, MatchDTO[]>();
    for (const m of filtered) {
      const r = m.roundNumber || 1;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  async function runMatchmaking(action: "preview" | "generate" | "regenerate" | "schedule_all") {
    if (action === "regenerate" && !window.confirm("Delete all unstarted matches and unlock matchmaking?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament._id}/matchmaking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Matchmaking failed");
      if (action === "preview") {
        setPreviewPairs(data.preview || []);
        push(`Preview generated for ${data.entrantCount} verified entrants.`, "info");
      } else if (action === "generate") {
        setPreviewPairs(null);
        push(`Generated ${data.created} matches! Tournament is Live.`, "success");
        await onRefresh();
      } else if (action === "schedule_all") {
        push(`Scheduled ${data.scheduled} matches (${data.unscheduled} unscheduled).`, "success");
        await onRefresh();
      } else {
        push(`Cleared ${data.deletedMatches} unstarted matches.`, "info");
        await onRefresh();
      }
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function createManualMatch(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament._id}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sideA, sideB, mapName,
          scheduledAt: schedAt ? new Date(schedAt).toISOString() : "",
          bracketId: tournament.bracketsEnabled ? manualBracket : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create match");
      push(`Created Match #${data.match.matchNumber}.`, "success");
      setSideA(""); setSideB(""); setShowManual(false);
      await onRefresh();
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const isElimination = tournament.format === "single_elimination" || tournament.format === "double_elimination";

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="arena-card p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-500">
            <Swords className="h-4 w-4" /> Matchmaking Engine ({tournament.format.replace(/_/g, " ")})
          </div>
          <div className="flex flex-wrap gap-2">
            {tournament.format !== "custom" && matches.length === 0 && (
              <>
                <button type="button" disabled={busy} onClick={() => runMatchmaking("preview")} className="arena-btn-secondary text-xs py-1.5"><Eye className="h-3.5 w-3.5" /> Preview</button>
                <button type="button" disabled={busy} onClick={() => runMatchmaking("generate")} className="arena-btn-primary text-xs py-1.5"><Sparkles className="h-3.5 w-3.5" /> Generate Matches</button>
              </>
            )}
            {matches.length > 0 && (
              <>
                <button type="button" disabled={busy} onClick={() => runMatchmaking("schedule_all")} className="arena-btn-secondary text-xs py-1.5"><CalendarClock className="h-3.5 w-3.5" /> Auto-Schedule All</button>
                <button type="button" disabled={busy} onClick={() => runMatchmaking("regenerate")} className="arena-btn-danger text-xs py-1.5"><RotateCcw className="h-3.5 w-3.5" /> Regenerate</button>
              </>
            )}
            <button type="button" onClick={() => setShowManual((v) => !v)} className="arena-btn-secondary text-xs py-1.5"><Plus className="h-3.5 w-3.5" /> Manual Match</button>
          </div>
        </div>
      )}

      {showManual && canManage && (
        <form onSubmit={createManualMatch} className="arena-card p-5 space-y-3 border-cyan-500/40">
          <h4 className="font-display-caps text-sm font-bold text-cyan-500">Create Custom / Rematch Post</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-[11px] font-bold uppercase text-[var(--arena-muted)]">Side A ({tournament.mode === "team" ? "Team" : "Discord ID"})</label>
              <input className="arena-input mt-1" list="sse-side-options" value={sideA} onChange={(e) => setSideA(e.target.value)} required />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase text-[var(--arena-muted)]">Side B ({tournament.mode === "team" ? "Team" : "Discord ID"})</label>
              <input className="arena-input mt-1" list="sse-side-options" value={sideB} onChange={(e) => setSideB(e.target.value)} required />
            </div>
            <datalist id="sse-side-options">
              {tournament.mode === "team"
                ? teams.filter((t) => t.status === "active").map((t) => <option key={t._id} value={t.name} />)
                : registrations.filter((r) => r.status === "registered").map((r) => <option key={r._id} value={r.userId}>{r.inGameId || r.displayName}</option>)}
            </datalist>
            <div>
              <label className="text-[11px] font-bold uppercase text-[var(--arena-muted)]">Map</label>
              <input className="arena-input mt-1" placeholder="Default rotation" value={mapName} onChange={(e) => setMapName(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase text-[var(--arena-muted)]">Schedule</label>
              <input type="datetime-local" className="arena-input mt-1" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} />
            </div>
            {tournament.bracketsEnabled && (
              <div>
                <label className="text-[11px] font-bold uppercase text-[var(--arena-muted)]">Bracket</label>
                <select className="arena-input mt-1" value={manualBracket} onChange={(e) => setManualBracket(e.target.value)}>
                  {tournament.brackets.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-end"><button type="submit" disabled={busy} className="arena-btn-primary w-full">Create Match Post</button></div>
          </div>
        </form>
      )}

      {previewPairs && (
        <div className="arena-card p-5 border-amber-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-display-caps text-sm font-bold text-amber-500">Matchmaking Preview ({previewPairs.length} Matches)</h4>
            <button type="button" onClick={() => setPreviewPairs(null)} className="text-xs text-[var(--arena-muted)] hover:underline">Dismiss</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {previewPairs.map((p, i) => (
              <div key={i} className="rounded-lg border border-[var(--arena-border)] bg-[var(--arena-elevated)] px-3 py-2 text-xs flex items-center justify-between gap-2">
                <span className="font-semibold truncate">{p.sideA}</span>
                <span className="font-display-caps text-[10px] font-bold text-amber-500">VS</span>
                <span className="font-semibold truncate text-right">{p.sideB}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tournament.bracketsEnabled && tournament.brackets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelectedBracket("all")} className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase border ${selectedBracket === "all" ? "border-amber-500 bg-amber-500/15 text-amber-500" : "border-[var(--arena-border)] bg-[var(--arena-surface)] text-[var(--arena-muted)]"}`}>
            All Brackets
          </button>
          {tournament.brackets.map((b) => (
            <button key={b._id} type="button" onClick={() => setSelectedBracket(b._id)} className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase border ${selectedBracket === b._id ? "border-cyan-500 bg-cyan-500/15 text-cyan-500" : "border-[var(--arena-border)] bg-[var(--arena-surface)] text-[var(--arena-muted)]"}`}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      {rounds.length === 0 ? (
        <div className="arena-card p-10 text-center space-y-2">
          <Swords className="mx-auto h-8 w-8 text-[var(--arena-muted)]" />
          <div className="font-display-caps text-base font-bold">No Matches Generated Yet</div>
          <p className="text-xs text-[var(--arena-muted)]">Close registration, verify player squad powers, and run Matchmaking.</p>
        </div>
      ) : (
        <div className={isElimination ? "flex gap-6 overflow-x-auto pb-4 items-start" : "space-y-6"}>
          {rounds.map(([roundNo, rMatches]) => (
            <div key={roundNo} className={isElimination ? "min-w-[300px] shrink-0 space-y-3" : "space-y-3"}>
              <div className="flex items-center justify-between border-b border-[var(--arena-border)] pb-2">
                <h4 className="font-display-caps text-sm font-bold text-amber-500">Round {roundNo}</h4>
                <span className="font-mono text-[11px] text-[var(--arena-muted)]">{rMatches.length} matches</span>
              </div>
              <div className={isElimination ? "space-y-3" : "grid gap-3 md:grid-cols-2 lg:grid-cols-3"}>
                {rMatches.map((m) => {
                  const winA = (m.status === "approved" || m.status === "forfeited") && m.reportedWinnerSide === "A";
                  const winB = (m.status === "approved" || m.status === "forfeited") && m.reportedWinnerSide === "B";
                  return (
                    <Link key={m._id} href={`/tournaments/${tournament._id}/matches/${m._id}`} className="block arena-card p-3.5 hover:border-amber-500/70 transition-all group">
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="font-mono text-xs font-bold text-[var(--arena-muted)]">
                          MATCH #{String(m.matchNumber).padStart(3, "0")}
                          {m.seriesBestOf && m.seriesBestOf > 1 ? ` · G${m.seriesIndex}/${m.seriesBestOf}` : ""}
                        </span>
                        <MatchStatusBadge status={m.status} />
                      </div>
                      <div className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-sm mb-1.5 border ${winA ? "border-emerald-500/50 bg-emerald-500/10 font-bold" : "border-transparent bg-[var(--arena-elevated)]"}`}>
                        <span className="truncate">{sideLabel(m, "A")}</span>
                        <span className="font-mono text-[11px] text-[var(--arena-muted)] ml-2">{winA ? "WIN" : m.sideAPower ? `${Math.round(m.sideAPower)} SP` : ""}</span>
                      </div>
                      <div className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-sm border ${winB ? "border-emerald-500/50 bg-emerald-500/10 font-bold" : "border-transparent bg-[var(--arena-elevated)]"}`}>
                        <span className="truncate">{sideLabel(m, "B")}</span>
                        <span className="font-mono text-[11px] text-[var(--arena-muted)] ml-2">{winB ? "WIN" : m.sideBPower ? `${Math.round(m.sideBPower)} SP` : ""}</span>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-[var(--arena-border)] flex items-center justify-between text-[11px] text-[var(--arena-muted)]">
                        <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 text-cyan-500 shrink-0" /> {m.mapName || "TBD"}</span>
                        <span className="flex items-center gap-1 text-amber-500 font-semibold">
                          {m.channelId ? <><Hash className="h-3 w-3" /> Post</> : <>Match Room <ExternalLink className="h-3 w-3" /></>}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import type { CSSProperties } from "react";

import { useMemo, useState } from "react";
import { Calendar, Crown, Image as ImageIcon, MapPin, Swords, X } from "lucide-react";
import { MATCH_STATUS_COLORS, type MatchRow, type PowerBracket } from "@/lib/tournament-types";

export function BracketBoard({ matches, brackets }: { matches: MatchRow[]; brackets: PowerBracket[] }) {
  const [selectedBracket, setSelectedBracket] = useState<string>("all");
  const [proofPreview, setProofPreview] = useState<MatchRow | null>(null);

  const filtered = useMemo(() => {
    if (selectedBracket === "all") return matches;
    return matches.filter((m) => m.bracketId === selectedBracket);
  }, [matches, selectedBracket]);

  const rounds = useMemo(() => {
    const map = new Map<number, MatchRow[]>();
    for (const m of filtered) {
      const r = m.roundNumber || 1;
      const list = map.get(r) || [];
      list.push(m);
      map.set(r, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  if (matches.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-10 text-center">
        <Swords className="mx-auto mb-3 h-10 w-10 text-slate-500" />
        <h3 className="text-sm font-bold text-white">No Matches Generated Yet</h3>
        <p className="mt-1 text-xs text-slate-400">
          Matches will appear here automatically once a manager runs{" "}
          <code className="text-indigo-400">/matchmaking</code> or{" "}
          <code className="text-indigo-400">/match create</code> in Discord.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {brackets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedBracket("all")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${selectedBracket === "all" ? "bg-indigo-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-300"}`}
          >
            All Brackets ({matches.length})
          </button>
          {brackets.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedBracket(b.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${selectedBracket === b.id ? "bg-indigo-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-300"}`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-3">
        {rounds.map(([roundNum, roundMatches]) => (
          <div key={roundNum} className="w-[300px] shrink-0 space-y-3 sm:w-[330px]">
            <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-2.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">Round {roundNum}</span>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                {roundMatches.length} match{roundMatches.length === 1 ? "" : "es"}
              </span>
            </div>

            <div className="space-y-3">
              {roundMatches.map((m) => {
                const st = MATCH_STATUS_COLORS[m.status] || MATCH_STATUS_COLORS.scheduled;
                const aWon = ["approved", "forfeited"].includes(m.status) && m.reportedWinnerSide === "A";
                const bWon = ["approved", "forfeited"].includes(m.status) && m.reportedWinnerSide === "B";

                return (
                  <div key={m.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/75 shadow-md">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/60 px-3.5 py-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
                        <span className="font-mono text-indigo-400">M{String(m.matchNumber).padStart(3, "0")}</span>
                        {m.seriesIndex && m.seriesBestOf && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">G{m.seriesIndex}/Bo{m.seriesBestOf}</span>
                        )}
                        {m.bracketName && (
                          <span className="truncate rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300">{m.bracketName}</span>
                        )}
                      </div>
                      <span
                        className="sse-status-pill rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase"
                        style={
                          {
                            backgroundColor: st.bg,
                            "--pill-dark": st.color,
                            "--pill-light": st.lightColor,
                          } as CSSProperties
                        }
                      >
                        {st.label}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-800/70">
                      <div className={`flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs ${aWon ? "bg-emerald-500/10" : ""}`}>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-800 font-mono text-[10px] font-bold text-slate-300">A</span>
                          <span className={`truncate font-bold ${aWon ? "text-emerald-300" : "text-white"}`}>{m.sideALabel}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {m.sideAPower > 0 && <span className="font-mono text-[10px] text-slate-400">{Math.round(m.sideAPower)} SP</span>}
                          {aWon && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                        </div>
                      </div>

                      <div className={`flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs ${bWon ? "bg-emerald-500/10" : ""}`}>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-800 font-mono text-[10px] font-bold text-slate-300">B</span>
                          <span className={`truncate font-bold ${m.isBye ? "italic text-slate-500" : bWon ? "text-emerald-300" : "text-white"}`}>{m.sideBLabel}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {m.sideBPower > 0 && <span className="font-mono text-[10px] text-slate-400">{Math.round(m.sideBPower)} SP</span>}
                          {bWon && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 bg-slate-950/40 px-3.5 py-2 text-[10px] text-slate-400">
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 text-indigo-400" />
                        {m.mapName}
                      </span>
                      <div className="flex items-center gap-2">
                        {m.scheduledAt && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(m.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                        )}
                        {m.proofUrl && (
                          <button
                            type="button"
                            onClick={() => setProofPreview(m)}
                            className="inline-flex items-center gap-1 rounded-md border border-indigo-500/40 bg-indigo-500/15 px-1.5 py-0.5 font-bold text-indigo-300"
                          >
                            <ImageIcon className="h-2.5 w-2.5" /> Proof
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {proofPreview?.proofUrl && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setProofPreview(null)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-700 bg-[#0b1120] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
              <div>
                <div className="text-sm font-bold text-white">Match #{String(proofPreview.matchNumber).padStart(3, "0")} Proof Evidence</div>
                <div className="text-[11px] text-slate-400">{proofPreview.sideALabel} vs {proofPreview.sideBLabel} · Reported Winner: {proofPreview.reportedWinnerSide || "—"}</div>
              </div>
              <button type="button" onClick={() => setProofPreview(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[75vh] overflow-auto bg-slate-950 p-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proofPreview.proofUrl} alt="Match Proof" className="mx-auto max-h-[65vh] rounded-2xl object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

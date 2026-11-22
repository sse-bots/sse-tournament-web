"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Trophy, ArrowRight, ArrowLeft, Layers, Users, Swords } from "lucide-react";
import {
  GameDTO,
  TOURNAMENT_FORMATS,
  TOURNAMENT_MODES,
  SCORING_SYSTEMS,
  TEAM_POWER_RULES,
} from "@/lib/types";
import { useArena } from "@/components/theme-provider";
import { useToast } from "@/components/ui/toast";
import { AuthGuard } from "@/components/auth-guard";

function NewDraftForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeGuildId } = useArena();
  const { push } = useToast();

  const [guildId, setGuildId] = useState(searchParams.get("guildId") || activeGuildId || "");
  const [games, setGames] = useState<GameDTO[]>([]);
  const [gameId, setGameId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<string>("single_elimination");
  const [mode, setMode] = useState<string>("individual");
  const [scoring, setScoring] = useState<string>("wins");
  const [bracketsEnabled, setBracketsEnabled] = useState(true);
  const [teamSizeMin, setTeamSizeMin] = useState("2");
  const [teamSizeMax, setTeamSizeMax] = useState("5");
  const [teamPowerRule, setTeamPowerRule] = useState("average");
  const [managerRoleIds, setManagerRoleIds] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const paramGid = searchParams.get("guildId");
    if (paramGid) {
      setGuildId(paramGid);
    } else if (activeGuildId) {
      setGuildId((prev) => prev || activeGuildId);
    }
  }, [searchParams, activeGuildId]);

  useEffect(() => {
    let active = true;
    async function loadGames() {
      const res = await fetch(
        `/api/games${guildId ? `?guildId=${encodeURIComponent(guildId)}` : ""}`
      );
      if (!res.ok || !active) return;
      const data = await res.json();
      const rows: GameDTO[] = data.games || [];
      setGames(rows);
      setGameId((prev) => (rows.some((g) => g._id === prev) ? prev : rows[0]?._id || ""));
    }
    loadGames();
    return () => {
      active = false;
    };
  }, [guildId]);

  async function handleCreateDraft(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          gameId,
          name,
          description,
          format,
          mode,
          scoring,
          bracketsEnabled,
          teamSizeMin: Number(teamSizeMin),
          teamSizeMax: Number(teamSizeMax),
          teamPowerRule,
          managerRoleIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create draft");
      push(`Draft "${name}" created! Configure brackets & publish next.`, "success");
      router.push(`/tournaments/${data.tournament._id}?tab=setup`);
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      <div className="space-y-1.5">
        <Link
          href={guildId ? `/dashboard/${guildId}` : "/dashboard"}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--arena-muted)] hover:text-amber-500"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Server Arena
        </Link>
        <div className="text-xs font-bold uppercase tracking-widest text-amber-500">
          Starting Draft
        </div>
        <h1 className="font-display-caps text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5">
          <Trophy className="h-6 w-6 sm:h-7 sm:w-7 text-amber-500 shrink-0" /> Create Tournament Draft
        </h1>
        <p className="text-xs sm:text-sm text-[var(--arena-muted)]">
          Starts safely in <strong>Draft</strong> mode. Configure Squad Power brackets, maps, schedules, and prizes before publishing.
        </p>
      </div>

      <form onSubmit={handleCreateDraft} className="arena-card p-5 sm:p-6 space-y-6 shadow-arena">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">
              Discord Server (Guild) ID
            </label>
            <input
              className="arena-input mt-1 font-mono"
              placeholder="123456789012345678"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Game</label>
            <select
              className="arena-input mt-1"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              required
            >
              {games.length === 0 && <option value="">No games found — add one first</option>}
              {games.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
            {games.length === 0 && (
              <Link href="/games" className="text-xs text-amber-500 hover:underline mt-1 inline-block">
                + Register a game in Games Registry
              </Link>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">
              Tournament Public Name
            </label>
            <input
              className="arena-input mt-1"
              placeholder="e.g. Mech Arena MAQC Championship"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">
              Rules & Overview
            </label>
            <textarea
              rows={3}
              className="arena-input mt-1"
              placeholder="Eligibility, screenshot proof rules, map bans..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 border-t border-[var(--arena-border)] pt-5">
          <div>
            <label className="text-xs font-bold uppercase text-[var(--arena-muted)] flex items-center gap-1">
              <Swords className="h-3.5 w-3.5 text-amber-500" /> Format
            </label>
            <select className="arena-input mt-1" value={format} onChange={(e) => setFormat(e.target.value)}>
              {TOURNAMENT_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f.replace(/_/g, " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-[var(--arena-muted)] flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-cyan-500" /> Mode
            </label>
            <select className="arena-input mt-1" value={mode} onChange={(e) => setMode(e.target.value)}>
              {TOURNAMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">
              Scoring System
            </label>
            <select className="arena-input mt-1" value={scoring} onChange={(e) => setScoring(e.target.value)}>
              {SCORING_SYSTEMS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {mode === "team" && (
          <div className="grid gap-4 sm:grid-cols-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
            <div>
              <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">
                Min Team Size
              </label>
              <input
                type="number"
                min="1"
                max="20"
                className="arena-input mt-1 font-mono"
                value={teamSizeMin}
                onChange={(e) => setTeamSizeMin(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">
                Max Team Size
              </label>
              <input
                type="number"
                min="1"
                max="20"
                className="arena-input mt-1 font-mono"
                value={teamSizeMax}
                onChange={(e) => setTeamSizeMax(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">
                Team Bracket Rule
              </label>
              <select
                className="arena-input mt-1"
                value={teamPowerRule}
                onChange={(e) => setTeamPowerRule(e.target.value)}
              >
                {TEAM_POWER_RULES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/_/g, " ").toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 border-t border-[var(--arena-border)] pt-5 items-center">
          <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-[var(--arena-border)] bg-[var(--arena-elevated)] p-3.5">
            <input
              type="checkbox"
              className="mt-1"
              checked={bracketsEnabled}
              onChange={(e) => setBracketsEnabled(e.target.checked)}
            />
            <div>
              <div className="text-sm font-bold flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-cyan-500" /> Squad-Power Brackets
              </div>
              <div className="text-xs text-[var(--arena-muted)]">
                Configure SP divisions inside the draft before publishing.
              </div>
            </div>
          </label>
          <div>
            <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">
              Manager Role IDs (comma-sep)
            </label>
            <input
              className="arena-input mt-1 font-mono text-xs"
              placeholder="Optional Discord Role IDs"
              value={managerRoleIds}
              onChange={(e) => setManagerRoleIds(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
          <Link href={guildId ? `/dashboard/${guildId}` : "/dashboard"} className="arena-btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={busy || !gameId} className="arena-btn-primary shadow-glowGold">
            <span>{busy ? "Creating Draft..." : "Create Draft & Open Setup"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewTournamentDraftPage() {
  return (
    <AuthGuard>
      <Suspense
        fallback={
          <div className="py-16 text-center text-sm text-[var(--arena-muted)]">
            Loading draft wizard...
          </div>
        }
      >
        <NewDraftForm />
      </Suspense>
    </AuthGuard>
  );
}

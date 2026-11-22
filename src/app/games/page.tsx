"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Gamepad2, Plus, Edit3, Trash2, ArrowLeft } from "lucide-react";
import { GameDTO } from "@/lib/types";
import { useArena } from "@/components/theme-provider";
import { useToast } from "@/components/ui/toast";
import { AuthGuard } from "@/components/auth-guard";

function GamesContent() {
  const { activeGuildId } = useArena();
  const { push } = useToast();
  const [games, setGames] = useState<GameDTO[]>([]);
  const [name, setName] = useState("");
  const [guildId, setGuildId] = useState(activeGuildId);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeGuildId) setGuildId(activeGuildId);
  }, [activeGuildId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/games${activeGuildId ? `?guildId=${encodeURIComponent(activeGuildId)}` : ""}`
      );
      if (res.ok) {
        const data = await res.json();
        setGames(data.games || []);
      }
    } finally {
      setLoading(false);
    }
  }, [activeGuildId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addGame(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, guildId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create game");
      push(`Added game "${name}".`, "success");
      setName("");
      await load();
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function renameGame(g: GameDTO) {
    const newName = window.prompt("New game name:", g.name);
    if (!newName || newName.trim() === g.name) return;
    const res = await fetch(`/api/games/${g._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    const data = await res.json();
    if (!res.ok) return push(data.error || "Rename failed", "error");
    push(`Renamed game to "${newName}".`, "success");
    await load();
  }

  async function deleteGame(g: GameDTO) {
    if (!window.confirm(`Deactivate game "${g.name}"?`)) return;
    const res = await fetch(`/api/games/${g._id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return push(data.error || "Delete failed", "error");
    push(`Deactivated "${g.name}".`, "info");
    await load();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      <div className="space-y-1.5">
        <Link
          href={activeGuildId ? `/dashboard/${activeGuildId}` : "/dashboard"}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--arena-muted)] hover:text-amber-500"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </Link>
        <h1 className="font-display-caps text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5">
          <Gamepad2 className="h-6 w-6 sm:h-7 sm:w-7 text-amber-500 shrink-0" /> Games Registry
        </h1>
        <p className="text-xs sm:text-sm text-[var(--arena-muted)]">
          Manage games available for tournaments in your Discord server (e.g., Mech Arena, Free Fire, Minecraft).
        </p>
      </div>

      <form onSubmit={addGame} className="arena-card p-4 sm:p-5 grid gap-3 sm:grid-cols-3 items-end">
        <div>
          <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Game Name</label>
          <input
            className="arena-input mt-1"
            placeholder="e.g. Mech Arena"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
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
        <button type="submit" disabled={busy} className="arena-btn-primary w-full">
          <Plus className="h-4 w-4" /> Add Game
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        {loading ? (
          <div className="arena-card sm:col-span-2 p-8 text-center text-sm text-[var(--arena-muted)]">
            Loading games...
          </div>
        ) : games.length === 0 ? (
          <div className="arena-card sm:col-span-2 p-8 text-center text-sm text-[var(--arena-muted)]">
            No games registered yet. Add your first game above.
          </div>
        ) : (
          games.map((g) => (
            <div key={g._id} className="arena-card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display-caps text-base sm:text-lg font-bold truncate">
                  {g.name}
                </div>
                <div className="font-mono text-[11px] text-[var(--arena-muted)] truncate">
                  Server {g.guildId} • ID {g._id.slice(-6)}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => renameGame(g)}
                  className="p-2 rounded-lg hover:bg-[var(--arena-elevated)] text-cyan-500"
                  title="Rename"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteGame(g)}
                  className="p-2 rounded-lg hover:bg-red-500/15 text-red-500"
                  title="Deactivate"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function GamesPage() {
  return (
    <AuthGuard>
      <GamesContent />
    </AuthGuard>
  );
}

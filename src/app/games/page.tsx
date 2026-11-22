"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Gamepad2, Plus, Edit3, Trash2 } from "lucide-react";
import { GameDTO } from "@/lib/types";
import { useArena } from "@/components/theme-provider";
import { useToast } from "@/components/ui/toast";

export default function GamesPage() {
  const { activeGuildId, actor } = useArena();
  const { push } = useToast();
  const [games, setGames] = useState<GameDTO[]>([]);
  const [name, setName] = useState("");
  const [guildId, setGuildId] = useState(activeGuildId);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (activeGuildId) setGuildId(activeGuildId);
  }, [activeGuildId]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/games${activeGuildId ? `?guildId=${encodeURIComponent(activeGuildId)}` : ""}`);
    if (res.ok) {
      const data = await res.json();
      setGames(data.games || []);
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
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
      <div>
        <h1 className="font-display-caps text-3xl font-extrabold flex items-center gap-2.5">
          <Gamepad2 className="h-7 w-7 text-amber-500" /> Games Registry
        </h1>
        <p className="text-sm text-[var(--arena-muted)] mt-1">
          Configure games available for tournaments in your Discord server (e.g., Mech Arena, Free Fire, Minecraft).
        </p>
      </div>

      <form onSubmit={addGame} className="arena-card p-5 grid gap-3 sm:grid-cols-3 items-end">
        <div>
          <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Game Name</label>
          <input className="arena-input mt-1" placeholder="e.g. Mech Arena" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Discord Server (Guild) ID</label>
          <input className="arena-input mt-1 font-mono" placeholder="123456789012345678" value={guildId} onChange={(e) => setGuildId(e.target.value)} required />
        </div>
        <button type="submit" disabled={busy || !actor} className="arena-btn-primary">
          <Plus className="h-4 w-4" /> Add Game
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        {games.length === 0 ? (
          <div className="arena-card sm:col-span-2 p-8 text-center text-sm text-[var(--arena-muted)]">
            No games registered yet. Add your first game above.
          </div>
        ) : (
          games.map((g) => (
            <div key={g._id} className="arena-card p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-display-caps text-lg font-bold">{g.name}</div>
                <div className="font-mono text-[11px] text-[var(--arena-muted)]">
                  Server {g.guildId} • ID {g._id.slice(-6)}
                </div>
              </div>
              {actor && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => renameGame(g)} className="p-2 rounded-lg hover:bg-[var(--arena-elevated)] text-cyan-500" title="Rename">
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => deleteGame(g)} className="p-2 rounded-lg hover:bg-red-500/15 text-red-500" title="Deactivate">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

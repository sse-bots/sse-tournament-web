"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Check,
  Edit3,
  Gamepad2,
  Plus,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ServerGuard } from "@/components/ServerGuard";
import { useWorkspace } from "@/components/WorkspaceContext";
import type { GameRow } from "@/lib/tournament-types";

const QUICK_GAMES = [
  "Mech Arena",
  "Free Fire",
  "Minecraft",
  "BGMI",
  "Valorant",
  "COD Mobile",
];

export default function ServerGamesPage() {
  const params = useParams<{ guildId: string }>();
  const guildId = decodeURIComponent(params.guildId || "");
  const { serverData, refreshServer } = useWorkspace();

  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GameRow | null>(null);
  const [deletingGame, setDeletingGame] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = Boolean(serverData?.access.canManageGames);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  const loadGames = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/servers/${encodeURIComponent(guildId)}/games`,
        { cache: "no-store", credentials: "include" }
      );
      if (res.ok) {
        const j = await res.json();
        setGames(j.games || []);
      }
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    if (serverData) loadGames();
  }, [serverData, loadGames]);

  async function addGame(nameToAdd: string) {
    const trimmed = nameToAdd.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/servers/${encodeURIComponent(guildId)}/games`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not add game.");
        return;
      }
      setNewName("");
      showToast(`Added "${trimmed}" to server games.`);
      await Promise.all([loadGames(), refreshServer()]);
    } finally {
      setSaving(false);
    }
  }

  async function saveRename(id: string) {
    const trimmed = editingName.trim();
    if (trimmed.length < 2) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/servers/${encodeURIComponent(guildId)}/games`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name: trimmed }),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not rename game.");
        return;
      }
      setEditingId(null);
      setEditingName("");
      showToast(`Renamed game to "${trimmed}".`);
      await loadGames();
    } finally {
      setSaving(false);
    }
  }

  function deleteGame(g: GameRow) {
    setDeleteTarget(g);
  }

  async function confirmDeleteGame() {
    if (!deleteTarget) return;
    setDeletingGame(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/servers/${encodeURIComponent(guildId)}/games?id=${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE", credentials: "include" }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not remove game.");
        return;
      }
      showToast(`Deactivated "${deleteTarget.name}".`);
      setDeleteTarget(null);
      await Promise.all([loadGames(), refreshServer()]);
    } finally {
      setDeletingGame(false);
    }
  }

  const existingNamesLower = new Set(games.map((g) => g.name.toLowerCase()));
  const suggestedQuickGames = QUICK_GAMES.filter(
    (name) => !existingNamesLower.has(name.toLowerCase())
  );

  return (
    <ServerGuard guildId={guildId}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
              Server Games Catalog
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              {canManage
                ? "Add, rename, or deactivate games synced with /game commands in Discord."
                : "Active games hosted inside this Discord community."}
            </p>
          </div>
          <Link
            href={`/servers/${guildId}/tournaments`}
            className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:border-indigo-500 sm:self-center"
          >
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
            View Server Tournaments
          </Link>
        </div>

        {toast && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-300">
            {toast}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-300">
            {error}
          </div>
        )}

        {/* Owner-Only Add Game Panel */}
        {canManage && (
          <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addGame(newName);
              }}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <input
                required
                minLength={2}
                maxLength={60}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter game name (e.g. Mech Arena, Free Fire, Minecraft)..."
                className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={saving || newName.trim().length < 2}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {saving ? "Adding..." : "Add Game"}
              </button>
            </form>

            {suggestedQuickGames.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-3">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  1-Click Quick Add:
                </span>
                {suggestedQuickGames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    disabled={saving}
                    onClick={() => addGame(name)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-1 text-[11px] font-bold text-slate-200 transition hover:border-indigo-500 hover:text-white disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3 text-indigo-400" />
                    {name}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Games Grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-36 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60"
              />
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-12 text-center">
            <Gamepad2 className="mx-auto mb-3 h-10 w-10 text-slate-500" />
            <h2 className="text-base font-bold text-white">No Games Configured</h2>
            <p className="mt-1 text-xs text-slate-400">
              {canManage
                ? "Use the quick-add buttons above to add your server's games before creating tournaments."
                : "The Server Owner has not added any games yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g) => {
              const isEditing = editingId === g.id;
              return (
                <div
                  key={g.id}
                  className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900/70 p-5 transition hover:border-indigo-500/60"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400">
                        <Gamepad2 className="h-5 w-5" />
                      </span>
                      {canManage && !isEditing && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(g.id);
                              setEditingName(g.name);
                            }}
                            title="Rename game"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteGame(g)}
                            title="Deactivate game"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-3 flex items-center gap-1.5">
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="min-w-0 flex-1 rounded-xl border border-indigo-500 bg-slate-950 px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => saveRename(g.id)}
                          className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-500"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg bg-slate-800 p-1.5 text-slate-300 hover:text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <h2 className="mt-3 text-base font-extrabold text-white">
                        {g.name}
                      </h2>
                    )}

                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Trophy className="h-3 w-3 text-amber-400" />
                        <strong className="text-white">
                          {g.tournamentCount ?? 0}
                        </strong>{" "}
                        tournament{(g.tournamentCount ?? 0) === 1 ? "" : "s"}
                      </span>
                      <span>·</span>
                      <code className="font-mono text-[10px] text-slate-500">
                        {g.id.slice(-6)}
                      </code>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-800/80 pt-3">
                    {canManage ? (
                      <Link
                        href={`/servers/${guildId}/tournaments/new?gameId=${encodeURIComponent(g.id)}`}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-white transition hover:border-indigo-500 hover:bg-slate-700"
                      >
                        <Plus className="h-3.5 w-3.5 text-indigo-400" />
                        New {g.name} Tournament
                      </Link>
                    ) : (
                      <Link
                        href={`/servers/${guildId}/tournaments`}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-white transition hover:border-indigo-500"
                      >
                        Browse Tournaments
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
          <ConfirmModal
        open={Boolean(deleteTarget)}
        title={deleteTarget ? `Deactivate "${deleteTarget.name}"?` : "Deactivate Game"}
        description="Existing tournaments keep their full history, but this game will be hidden when creating new tournaments."
        confirmLabel={deletingGame ? "Deactivating..." : "Deactivate Game"}
        variant="danger"
        busy={deletingGame}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteGame}
      />
    </ServerGuard>
  );
}

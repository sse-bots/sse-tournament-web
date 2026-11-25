"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BookOpen,
  Gamepad2,
  LayoutDashboard,
  LogIn,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { TournamentCard } from "@/components/TournamentCard";
import {
  FORMAT_LABELS,
  SCORING_LABELS,
  type GameRow,
  type ManagedGuild,
  type TeamPowerRule,
  type TournamentFormat,
  type TournamentMode,
  type TournamentScoring,
  type TournamentSummary,
} from "@/lib/tournament-types";
import { SITE_SETTINGS } from "@/lib/site-settings";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [guilds, setGuilds] = useState<ManagedGuild[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string>("");
  const [games, setGames] = useState<GameRow[]>([]);
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [newGameName, setNewGameName] = useState("");
  const [addingGame, setAddingGame] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [tName, setTName] = useState("");
  const [tGameId, setTGameId] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tFormat, setTFormat] = useState<TournamentFormat>("single_elimination");
  const [tMode, setTMode] = useState<TournamentMode>("individual");
  const [tScoring, setTScoring] = useState<TournamentScoring>("wins");
  const [tBrackets, setTBrackets] = useState(true);
  const [tTeamMin, setTTeamMin] = useState(2);
  const [tTeamMax, setTTeamMax] = useState(4);
  const [tPowerRule, setTPowerRule] = useState<TeamPowerRule>("average");
  const [tSeriesBo, setTSeriesBo] = useState(3);
  const [tMaps, setTMaps] = useState("");
  const [tFirstPrize, setTFirstPrize] = useState("");
  const [tSecondPrize, setTSecondPrize] = useState("");
  const [tThirdPrize, setTThirdPrize] = useState("");
  const [creating, setCreating] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  const loadGuilds = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/guilds", { cache: "no-store", credentials: "include" });
      if (!res.ok) {
        setError("Could not load your Discord servers from SSE Accounts.");
        return;
      }
      const j = await res.json();
      const list: ManagedGuild[] = j.guilds || [];
      setGuilds(list);
      if (list.length > 0 && !selectedGuildId) setSelectedGuildId(list[0].id);
    } finally {
      setLoading(false);
    }
  }, [user, selectedGuildId]);

  const loadGuildData = useCallback(async (gid: string) => {
    if (!gid) return;
    const [gRes, tRes] = await Promise.all([
      fetch(`/api/games?guildId=${encodeURIComponent(gid)}`, { cache: "no-store" }),
      fetch(`/api/tournaments?guildId=${encodeURIComponent(gid)}&includeArchived=true`, { cache: "no-store" }),
    ]);
    if (gRes.ok) {
      const gj = await gRes.json();
      const list: GameRow[] = gj.games || [];
      setGames(list);
      if (list.length > 0) setTGameId((prev) => prev || list[0].id);
    }
    if (tRes.ok) {
      const tj = await tRes.json();
      setTournaments(tj.tournaments || []);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) loadGuilds();
    else if (!authLoading) setLoading(false);
  }, [authLoading, user, loadGuilds]);

  useEffect(() => {
    if (selectedGuildId) loadGuildData(selectedGuildId);
  }, [selectedGuildId, loadGuildData]);

  async function handleAddGame(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGuildId || !newGameName.trim()) return;
    setAddingGame(true);
    setError(null);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: selectedGuildId, name: newGameName.trim() }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Could not add game."); return; }
      setNewGameName("");
      showToast("Game added to server catalog.");
      await loadGuildData(selectedGuildId);
    } finally {
      setAddingGame(false);
    }
  }

  async function handleDeleteGame(game: GameRow) {
    if (!confirm(`Deactivate game "${game.name}"?`)) return;
    const res = await fetch(`/api/games?id=${encodeURIComponent(game.id)}`, { method: "DELETE", credentials: "include" });
    if (res.ok) { showToast(`Deactivated "${game.name}".`); await loadGuildData(selectedGuildId); }
  }

  async function handleCreateTournament(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGuildId || !tGameId) { setError("Add and select a game first."); return; }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId: selectedGuildId,
          name: tName.trim(),
          gameId: tGameId,
          description: tDesc.trim(),
          format: tFormat,
          mode: tMode,
          scoring: tScoring,
          bracketsEnabled: tBrackets,
          teamSizeMin: tTeamMin,
          teamSizeMax: tTeamMax,
          teamPowerRule: tPowerRule,
          seriesBestOf: tSeriesBo,
          maps: tMaps.split(",").map((s) => s.trim()).filter(Boolean),
          prizes: {
            first: tFirstPrize.trim() || undefined,
            second: tSecondPrize.trim() || undefined,
            third: tThirdPrize.trim() || undefined,
          },
        }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Could not create tournament."); return; }
      setCreateOpen(false);
      setTName(""); setTDesc(""); setTMaps(""); setTFirstPrize(""); setTSecondPrize(""); setTThirdPrize("");
      showToast("Tournament created in Draft mode!");
      await loadGuildData(selectedGuildId);
    } finally {
      setCreating(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="space-y-4 py-8">
        <div className="h-12 w-64 animate-pulse rounded-2xl bg-slate-900/70" />
        <div className="h-44 animate-pulse rounded-3xl bg-slate-900/60" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center shadow-2xl">
        <LayoutDashboard className="mx-auto mb-3 h-10 w-10 text-indigo-400" />
        <h1 className="text-xl font-extrabold text-white">Manager Sign-In Required</h1>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Sign in with your centralized <strong className="text-white">SSE Account</strong> to manage your Discord servers, games, squad-power approvals, and tournament brackets.
        </p>
        <Link href="/api/auth/login?next=/dashboard" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500">
          <LogIn className="h-4 w-4" /> Sign In with SSE Accounts
        </Link>
      </div>
    );
  }

  const activeGuild = guilds.find((g) => g.id === selectedGuildId);
  const pendingPowerTotal = tournaments.reduce((s, t) => s + t.counts.pendingPower, 0);
  const pendingReviewTotal = tournaments.reduce((s, t) => s + t.counts.pendingReview + t.counts.disputed, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-white sm:text-3xl">Manager Control Center</h1>
          <p className="mt-1 text-xs text-slate-400">
            Signed in as <strong className="text-white">{user.name}</strong>{user.discordUsername ? ` (Discord @${user.discordUsername})` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => selectedGuildId && loadGuildData(selectedGuildId)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-indigo-500">
            <RefreshCw className="h-3.5 w-3.5" /> Sync Live
          </button>
          <button type="button" disabled={!selectedGuildId} onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Create Tournament
          </button>
        </div>
      </div>

      {toast && <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">{toast}</div>}
      {error && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-300">{error}</div>}

      {guilds.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 text-center">
          <Server className="mx-auto mb-3 h-10 w-10 text-amber-400" />
          <h2 className="text-base font-bold text-white">No Manageable Discord Servers Found</h2>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-400">
            Link your Discord account inside{" "}
            <a href={`${SITE_SETTINGS.links.accountsUrl}/account/security`} target="_blank" rel="noreferrer" className="font-semibold text-indigo-400 underline">SSE Accounts → Security &amp; Links</a>{" "}
            and ensure you have <strong>Manage Server</strong> or <strong>Administrator</strong> permission.
          </p>
        </div>
      ) : (
        <>
          <section className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Server className="h-4 w-4 text-indigo-400" /> Select Discord Server ({guilds.length})
              </div>
              {activeGuild && !activeGuild.botConfigured && (
                <Link href="/docs" className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:underline">
                  <BookOpen className="h-3.5 w-3.5" /> Run /activate &amp; /setup in Discord →
                </Link>
              )}
            </div>
            <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
              {guilds.map((g) => (
                <button key={g.id} type="button" onClick={() => setSelectedGuildId(g.id)} className={`flex shrink-0 items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left transition ${g.id === selectedGuildId ? "border-indigo-500 bg-indigo-500/15" : "border-slate-800 bg-slate-950/70 hover:border-slate-700"}`}>
                  {g.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.icon} alt={g.name} className="h-8 w-8 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-xs font-bold text-white">{g.name.slice(0, 2).toUpperCase()}</div>
                  )}
                  <div>
                    <div className="max-w-[160px] truncate text-xs font-bold text-white">{g.name}</div>
                    <div className="text-[10px] text-slate-400">{g.tournamentCount} arenas · {g.gameCount} games</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {(pendingPowerTotal > 0 || pendingReviewTotal > 0) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pendingPowerTotal > 0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200">
                  <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
                  <div><strong className="text-white">{pendingPowerTotal} Squad Power proof(s)</strong> awaiting approval.</div>
                </div>
              )}
              {pendingReviewTotal > 0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-purple-500/40 bg-purple-500/10 p-4 text-xs text-purple-200">
                  <AlertCircle className="h-5 w-5 shrink-0 text-purple-400" />
                  <div><strong className="text-white">{pendingReviewTotal} Match proof / dispute(s)</strong> waiting for review.</div>
                </div>
              )}
            </div>
          )}

          <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-extrabold text-white"><Gamepad2 className="h-4 w-4 text-indigo-400" /> Server Games Catalog ({games.length})</h2>
                <p className="text-[11px] text-slate-400">Synced with <code className="text-indigo-300">/game create</code> in Discord.</p>
              </div>
              <form onSubmit={handleAddGame} className="flex gap-2">
                <input required value={newGameName} onChange={(e) => setNewGameName(e.target.value)} placeholder="e.g. Mech Arena, Free Fire" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none" />
                <button type="submit" disabled={addingGame} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Add Game</button>
              </form>
            </div>
            {games.length === 0 ? (
              <p className="text-xs text-slate-400">No games added yet. Add Mech Arena, Free Fire, or Minecraft above.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {games.map((g) => (
                  <span key={g.id} className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-bold text-white">
                    <Gamepad2 className="h-3.5 w-3.5 text-indigo-400" /> {g.name}
                    <button type="button" onClick={() => handleDeleteGame(g)} title="Deactivate game" className="rounded p-0.5 text-slate-500 hover:text-rose-400"><Trash2 className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-white"><Trophy className="h-4 w-4 text-amber-400" /> Server Tournaments ({tournaments.length})</h2>
            {tournaments.length === 0 ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-10 text-center text-xs text-slate-400">
                No tournaments in this server yet. Click <strong className="text-white">Create Tournament</strong> to launch your first event!
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tournaments.map((t) => <TournamentCard key={t.id} tournament={t} manageHref={`/dashboard/tournaments/${t.id}`} />)}
              </div>
            )}
          </section>
        </>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => setCreateOpen(false)}>
          <form onSubmit={handleCreateTournament} onClick={(e) => e.stopPropagation()} className="max-h-[90dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-3xl border border-slate-700 bg-[#0b1120] p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-white">Create New Tournament</h2>
                <p className="text-[11px] text-slate-400">Saved directly to MongoDB — synced with Discord slash commands.</p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"><X className="h-4 w-4" /></button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Tournament Name *</label>
                <input required minLength={2} maxLength={100} value={tName} onChange={(e) => setTName(e.target.value)} placeholder="e.g. SSE Mech Arena Cup" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Game *</label>
                <select required value={tGameId} onChange={(e) => setTGameId(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white">
                  {games.length === 0 && <option value="">Add a game first</option>}
                  {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Description / Rules Summary</label>
              <textarea rows={2} value={tDesc} onChange={(e) => setTDesc(e.target.value)} placeholder="Match rules, hangar restrictions, lobby settings..." className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Format</label>
                <select value={tFormat} onChange={(e) => setTFormat(e.target.value as TournamentFormat)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white">
                  {(Object.keys(FORMAT_LABELS) as TournamentFormat[]).map((f) => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Mode</label>
                <select value={tMode} onChange={(e) => setTMode(e.target.value as TournamentMode)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white">
                  <option value="individual">Individual (Solo)</option>
                  <option value="team">Team / Squad</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Scoring</label>
                <select value={tScoring} onChange={(e) => setTScoring(e.target.value as TournamentScoring)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white">
                  {(Object.keys(SCORING_LABELS) as TournamentScoring[]).map((sc) => <option key={sc} value={sc}>{SCORING_LABELS[sc]}</option>)}
                </select>
              </div>
            </div>

            {tMode === "team" && (
              <div className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-300">Min Team</label>
                  <input type="number" min={1} max={20} value={tTeamMin} onChange={(e) => setTTeamMin(Number(e.target.value))} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-300">Max Team</label>
                  <input type="number" min={1} max={20} value={tTeamMax} onChange={(e) => setTTeamMax(Number(e.target.value))} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-300">Power Rule</label>
                  <select value={tPowerRule} onChange={(e) => setTPowerRule(e.target.value as TeamPowerRule)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-white">
                    <option value="average">Average</option>
                    <option value="all_members">All Members</option>
                    <option value="captain">Captain</option>
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
                <input type="checkbox" checked={tBrackets} onChange={(e) => setTBrackets(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
                <span><strong className="block text-white">Enable Squad-Power Brackets</strong>Group players by verified SP range</span>
              </label>
              {tFormat === "series" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">Series Best-Of (Odd)</label>
                  <input type="number" min={1} max={15} step={2} value={tSeriesBo} onChange={(e) => setTSeriesBo(Number(e.target.value))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white" />
                </div>
              )}
            </div>

            <input value={tMaps} onChange={(e) => setTMaps(e.target.value)} placeholder="Map Rotation (comma-separated, e.g. Agora, Skyship)" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white" />

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <input value={tFirstPrize} onChange={(e) => setTFirstPrize(e.target.value)} placeholder="1st Prize" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white" />
              <input value={tSecondPrize} onChange={(e) => setTSecondPrize(e.target.value)} placeholder="2nd Prize" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white" />
              <input value={tThirdPrize} onChange={(e) => setTThirdPrize(e.target.value)} placeholder="3rd Prize" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200">Cancel</button>
              <button type="submit" disabled={creating || games.length === 0} className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50">{creating ? "Creating..." : "Create Draft Tournament"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

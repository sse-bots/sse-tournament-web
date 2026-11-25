"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Filter, LayoutDashboard, Search, Trophy } from "lucide-react";
import { TournamentCard } from "@/components/TournamentCard";
import { FORMAT_LABELS, STATUS_META, type TournamentFormat, type TournamentStatus, type TournamentSummary } from "@/lib/tournament-types";

export default function TournamentsPage() {
  const [items, setItems] = useState<TournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [format, setFormat] = useState<string>("all");
  const [mode, setMode] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      if (status !== "all") sp.set("status", status);
      if (format !== "all") sp.set("format", format);
      if (mode !== "all") sp.set("mode", mode);
      const res = await fetch(`/api/tournaments?${sp.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        setItems(j.tournaments || []);
      }
    } finally {
      setLoading(false);
    }
  }, [q, status, format, mode]);

  useEffect(() => {
    const t = window.setTimeout(load, 220);
    return () => window.clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-white sm:text-3xl">Tournament Arenas</h1>
          <p className="mt-1 text-xs text-slate-400">Explore open registrations, live brackets, and archived championship standings across SSE communities.</p>
        </div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 self-start rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 sm:self-center">
          <LayoutDashboard className="h-4 w-4" /> Host / Manage
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tournament name..." className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white focus:border-indigo-500 focus:outline-none" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white">
          <option value="all">All Statuses</option>
          {(Object.keys(STATUS_META) as TournamentStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <select value={format} onChange={(e) => setFormat(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white">
          <option value="all">All Formats</option>
          {(Object.keys(FORMAT_LABELS) as TournamentFormat[]).map((f) => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
        </select>
        <select value={mode} onChange={(e) => setMode(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white">
          <option value="all">Solo &amp; Team Modes</option>
          <option value="individual">Solo / Individual</option>
          <option value="team">Team / Squad</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="h-56 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-12 text-center">
          <Filter className="mx-auto mb-2.5 h-8 w-8 text-slate-500" />
          <h3 className="text-sm font-bold text-white">No Tournaments Found</h3>
          <p className="mt-1 text-xs text-slate-400">Try clearing your filters or create a new tournament in the Manager Dashboard.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Trophy className="h-3.5 w-3.5 text-indigo-400" />
            Showing <strong className="text-white">{items.length}</strong> tournament{items.length === 1 ? "" : "s"}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => <TournamentCard key={t.id} tournament={t} />)}
          </div>
        </>
      )}
    </div>
  );
}

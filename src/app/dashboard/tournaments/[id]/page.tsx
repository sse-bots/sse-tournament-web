"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Flag,
  Image as ImageIcon,
  Layers,
  LifeBuoy,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  Settings,
  ShieldAlert,
  Swords,
  Trash2,
  Trophy,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  MATCH_STATUS_COLORS,
  SCORING_LABELS,
  STATUS_META,
  type AuditLogRow,
  type MatchRow,
  type RegistrationRow,
  type SupportTicketRow,
  type TeamRow,
  type TournamentScoring,
  type TournamentSummary,
} from "@/lib/tournament-types";

interface ManageDetailPayload {
  tournament: TournamentSummary;
  registrations: RegistrationRow[];
  teams: TeamRow[];
  matches: MatchRow[];
  tickets: SupportTicketRow[];
  auditLogs: AuditLogRow[];
  canManage: boolean;
}

export default function ManageTournamentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id || "";

  const [data, setData] = useState<ManageDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<"power" | "matches" | "config" | "tickets" | "audit">("power");
  const [proofModal, setProofModal] = useState<{ title: string; url: string } | null>(null);

  const [bName, setBName] = useState("");
  const [bMin, setBMin] = useState("0");
  const [bMax, setBMax] = useState("");

  const [editDesc, setEditDesc] = useState("");
  const [editMaps, setEditMaps] = useState("");
  const [editScoring, setEditScoring] = useState<TournamentScoring>("wins");
  const [editProofReq, setEditProofReq] = useState(true);
  const [editApprovalReq, setEditApprovalReq] = useState(true);
  const [editAllowDraws, setEditAllowDraws] = useState(false);
  const [editFirstPrize, setEditFirstPrize] = useState("");
  const [editSecondPrize, setEditSecondPrize] = useState("");
  const [editThirdPrize, setEditThirdPrize] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tournaments/${encodeURIComponent(id)}`, { cache: "no-store", credentials: "include" });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Could not load tournament."); return; }
      setData(j);
      const t: TournamentSummary = j.tournament;
      setEditDesc(t.description || "");
      setEditMaps((t.maps || []).join(", "));
      setEditScoring(t.scoring);
      setEditProofReq(t.resultPolicy.proofRequired);
      setEditApprovalReq(t.resultPolicy.approvalRequired);
      setEditAllowDraws(t.resultPolicy.allowDraws);
      setEditFirstPrize(t.prizeDescriptions.first || "");
      setEditSecondPrize(t.prizeDescriptions.second || "");
      setEditThirdPrize(t.prizeDescriptions.third || "");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function runTournamentAction(payload: Record<string, unknown>, successMsg: string) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/tournaments/${encodeURIComponent(id)}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Action failed."); return; }
      showToast(successMsg); await load();
    } finally { setBusy(false); }
  }

  async function runRegAction(payload: Record<string, unknown>, successMsg: string) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/tournaments/${encodeURIComponent(id)}/registrations`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Could not update registration."); return; }
      showToast(successMsg); await load();
    } finally { setBusy(false); }
  }

  async function runMatchAction(payload: Record<string, unknown>, successMsg: string) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/tournaments/${encodeURIComponent(id)}/matches`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Could not update match."); return; }
      showToast(successMsg); await load();
    } finally { setBusy(false); }
  }

  async function runTicketAction(ticketId: string, action: string, note = "") {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/tickets", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId, action, note }) });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Could not update ticket."); return; }
      showToast(`Ticket updated (${action}).`); await load();
    } finally { setBusy(false); }
  }

  async function handleDeleteTournament() {
    if (!confirm("Permanently delete this tournament and all its records?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "Could not delete tournament."); return; }
      router.push("/dashboard");
    } finally { setBusy(false); }
  }

  if (loading) {
    return (
      <div className="space-y-4 py-8">
        <div className="h-32 animate-pulse rounded-3xl bg-slate-900/70" />
        <div className="h-64 animate-pulse rounded-3xl bg-slate-900/60" />
      </div>
    );
  }

  if (!data || !data.canManage) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-rose-400" />
        <h1 className="text-lg font-bold text-white">Manager Access Denied</h1>
        <p className="mt-1.5 text-xs text-slate-400">{error || "Sign in with an SSE Account that manages this server."}</p>
        <Link href="/dashboard" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">Back to Dashboard</Link>
      </div>
    );
  }

  const { tournament: t, registrations, matches, tickets, auditLogs } = data;
  const st = STATUS_META[t.status] || STATUS_META.draft;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Manager Dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-indigo-500"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
          <a href={`/api/tournaments/${encodeURIComponent(t.id)}/export`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-indigo-500"><Download className="h-3.5 w-3.5" /> CSV Export</a>
          <Link href={`/tournaments/${t.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-500">Public Arena <ExternalLink className="h-3.5 w-3.5" /></Link>
        </div>
      </div>

      <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
              <span className="font-mono text-[11px] text-slate-400">ID: {t.id}</span>
            </div>
            <h1 className="mt-1.5 text-xl font-black text-white sm:text-2xl">{t.name}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(t.status === "draft" || t.status === "registration_closed") && !t.settingsLocked && (
              <button type="button" disabled={busy} onClick={() => runTournamentAction({ action: t.status === "draft" ? "open_registration" : "reopen_registration" }, "Registration is now OPEN!")} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"><Play className="h-3.5 w-3.5" /> Open Registration</button>
            )}
            {t.status === "registration" && (
              <button type="button" disabled={busy} onClick={() => runTournamentAction({ action: "close_registration" }, "Registration closed & team rosters locked.")} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" /> Close Registration</button>
            )}
            {t.status === "in_progress" && (
              <button type="button" disabled={busy} onClick={() => runTournamentAction({ action: "pause", reason: "Paused by manager" }, "Tournament paused.")} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50"><Pause className="h-3.5 w-3.5" /> Pause</button>
            )}
            {t.status === "paused" && (
              <button type="button" disabled={busy} onClick={() => runTournamentAction({ action: "resume" }, "Tournament resumed!")} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"><Play className="h-3.5 w-3.5" /> Resume</button>
            )}
            {(t.status === "in_progress" || t.status === "paused") && (
              <button type="button" disabled={busy} onClick={() => { if (confirm("Finish tournament and freeze final standings?")) runTournamentAction({ action: "finish", force: true }, "Tournament finished & standings frozen!"); }} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"><Trophy className="h-3.5 w-3.5" /> Finish &amp; Freeze</button>
            )}
            {(t.status === "completed" || t.status === "cancelled") && (
              <button type="button" disabled={busy} onClick={() => runTournamentAction({ action: "archive" }, "Tournament archived.")} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700"><Archive className="h-3.5 w-3.5" /> Archive</button>
            )}
            <button type="button" disabled={busy} onClick={handleDeleteTournament} className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          </div>
        </div>
        <p className="text-[11px] text-slate-400">
          Tip: After closing registration and approving Squad Power below, run <code className="font-mono text-indigo-300">/matchmaking tournament_id:{t.id}</code> in Discord to spawn private match channels.
        </p>
      </section>

      {toast && <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">{toast}</div>}
      {error && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-300">{error}</div>}

      <nav className="no-scrollbar flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70 p-1.5">
        {([
          { id: "power", label: `Squad Power & Roster (${t.counts.pendingPower} pending)`, icon: Users },
          { id: "matches", label: `Matches & Proof (${t.counts.pendingReview + t.counts.disputed} review)`, icon: Swords },
          { id: "config", label: "Brackets & Config", icon: Settings },
          { id: "tickets", label: `Tickets (${tickets.length})`, icon: LifeBuoy },
          { id: "audit", label: `Audit Log (${auditLogs.length})`, icon: ScrollText },
        ] as const).map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition ${tab === item.id ? "bg-indigo-600 text-white shadow-md" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
              <Icon className="h-3.5 w-3.5" /> {item.label}
            </button>
          );
        })}
      </nav>

      {tab === "power" && (
        <div className="space-y-3">
          {registrations.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-10 text-center text-xs text-slate-400">No registrations yet. Open registration so players can run <code className="text-indigo-300">/register</code>.</div>
          ) : (
            registrations.map((r) => (
              <div key={r.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/65 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-extrabold text-white">{r.inGameId || `Player #${r.userId.slice(-4)}`}</span>
                    <span className="font-mono text-[10px] text-slate-400">Discord: {r.userId}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${r.squadPowerStatus === "approved" ? "bg-emerald-500/15 text-emerald-300" : r.squadPowerStatus === "rejected" ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300"}`}>SP: {r.squadPowerStatus}</span>
                    {r.status !== "registered" && <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-300">{r.status}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>Claimed: <strong className="font-mono text-white">{r.claimedSquadPower ?? "—"}</strong></span>
                    <span>Verified: <strong className="font-mono text-emerald-400">{r.verifiedSquadPower ?? "—"}</strong></span>
                    {r.bracketName && <span className="text-amber-300">Bracket: <strong>{r.bracketName}</strong></span>}
                    {r.teamName && <span className="text-indigo-300">Team: <strong>{r.teamName}</strong></span>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {r.squadPowerProofUrl && (
                    <button type="button" onClick={() => setProofModal({ title: `Squad Power Proof — ${r.inGameId || r.userId}`, url: r.squadPowerProofUrl! })} className="inline-flex items-center gap-1 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-1.5 text-[11px] font-bold text-indigo-300"><ImageIcon className="h-3.5 w-3.5" /> Proof</button>
                  )}
                  {r.status === "registered" && (
                    <>
                      <button type="button" disabled={busy} onClick={() => runRegAction({ registrationId: r.id, action: "approve_power" }, "Squad Power approved!")} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500"><Check className="h-3.5 w-3.5" /> Approve</button>
                      <button type="button" disabled={busy} onClick={() => runRegAction({ registrationId: r.id, action: "reject_power", reason: "Screenshot unclear" }, "Squad Power rejected.")} className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-bold text-rose-300"><XCircle className="h-3.5 w-3.5" /> Reject</button>
                      <button type="button" disabled={busy} onClick={() => { const raw = prompt("Corrected verified average SP:", String(r.verifiedSquadPower ?? r.claimedSquadPower ?? 0)); if (raw === null) return; const num = Number(raw); if (Number.isNaN(num) || num < 0) return; const reason = prompt("Reason:", "Manual verification") || "Manual verification"; runRegAction({ registrationId: r.id, action: "adjust_power", verifiedAverage: num, reason }, `Verified SP updated to ${num}.`); }} className="rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-indigo-500">Adjust SP</button>
                      <button type="button" disabled={busy} onClick={() => { const reason = prompt("Disqualification reason:"); if (!reason) return; runRegAction({ registrationId: r.id, action: "disqualify", reason }, "Participant disqualified."); }} className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300">DQ</button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "matches" && (
        <div className="space-y-3">
          {matches.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-10 text-center text-xs text-slate-400">No matches yet. Run <code className="text-indigo-300">/matchmaking tournament_id:{t.id}</code> in Discord.</div>
          ) : (
            matches.map((m) => {
              const mst = MATCH_STATUS_COLORS[m.status] || MATCH_STATUS_COLORS.scheduled;
              return (
                <div key={m.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/65 p-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-indigo-400">R{m.roundNumber} · M{String(m.matchNumber).padStart(3, "0")}</span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ backgroundColor: mst.bg, color: mst.color }}>{mst.label}</span>
                      {m.bracketName && <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{m.bracketName}</span>}
                    </div>
                    <div className="text-sm font-extrabold text-white">
                      <span className="text-indigo-300">[A]</span> {m.sideALabel} <span className="mx-1.5 text-xs font-normal text-slate-500">vs</span> <span className="text-amber-300">[B]</span> {m.sideBLabel}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                      <span>Map: {m.mapName}</span>
                      {m.reportedWinnerSide && <span className="font-bold text-emerald-300">Reported Winner: Side {m.reportedWinnerSide}</span>}
                      {m.reviewNote && <span>Note: {m.reviewNote}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {m.proofUrl && (
                      <button type="button" onClick={() => setProofModal({ title: `Match #${String(m.matchNumber).padStart(3, "0")} Proof`, url: m.proofUrl! })} className="inline-flex items-center gap-1 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-1.5 text-[11px] font-bold text-indigo-300"><ImageIcon className="h-3.5 w-3.5" /> View Proof</button>
                    )}
                    {(m.status === "pending_review" || m.status === "disputed") && (
                      <>
                        <button type="button" disabled={busy} onClick={() => runMatchAction({ matchId: m.id, action: "approve", winnerSide: m.reportedWinnerSide || "A" }, "Match approved!")} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500"><Check className="h-3.5 w-3.5" /> Approve</button>
                        <button type="button" disabled={busy} onClick={() => runMatchAction({ matchId: m.id, action: "reject", note: "Invalid or unclear proof" }, "Match rejected.")} className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-bold text-rose-300">Reject</button>
                      </>
                    )}
                    {!["approved", "forfeited", "cancelled"].includes(m.status) && (
                      <button type="button" disabled={busy} onClick={() => { const side = prompt("Award forfeit to Side A or B:", "A")?.toUpperCase(); if (side !== "A" && side !== "B") return; const note = prompt("Forfeit reason:", "Opponent no-show") || "No-show"; runMatchAction({ matchId: m.id, action: "forfeit", winnerSide: side, note }, `Forfeit awarded to Side ${side}.`); }} className="inline-flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-300"><Flag className="h-3 w-3" /> Forfeit</button>
                    )}
                    {!m.seriesId && ["approved", "forfeited"].includes(m.status) && (
                      <button type="button" disabled={busy} onClick={() => { const side = prompt("Override winner to Side A or B:", m.reportedWinnerSide === "A" ? "B" : "A")?.toUpperCase(); if (side !== "A" && side !== "B") return; const note = prompt("Override reason:") || "Admin override"; runMatchAction({ matchId: m.id, action: "override", winnerSide: side, note }, `Overridden to Side ${side}.`); }} className="rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-indigo-500">Override</button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "config" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-white"><Layers className="h-4 w-4 text-amber-400" /> Squad-Power Brackets</h2>
            {!t.bracketsEnabled ? (
              <p className="text-xs text-slate-400">Power brackets are disabled for this tournament.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {t.brackets.map((b) => (
                    <div key={b.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2.5 text-xs">
                      <div><span className="font-bold text-white">{b.name}</span><span className="ml-2 font-mono text-[11px] text-amber-300">{b.minPower} – {b.maxPower ?? "∞"} SP</span></div>
                      {!t.settingsLocked && (
                        <button type="button" disabled={busy} onClick={() => runTournamentAction({ action: "delete_bracket", bracketName: b.name }, `Deleted bracket "${b.name}".`)} className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/15"><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  ))}
                  {t.brackets.length === 0 && <p className="text-xs text-slate-400">No brackets added yet.</p>}
                </div>
                {!t.settingsLocked && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!bName.trim()) return;
                      runTournamentAction({ action: "add_bracket", bracket: { name: bName.trim(), minPower: Number(bMin) || 0, maxPower: bMax.trim() === "" ? null : Number(bMax) } }, `Added bracket "${bName.trim()}".`).then(() => { setBName(""); setBMin("0"); setBMax(""); });
                    }}
                    className="space-y-2.5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
                  >
                    <div className="text-xs font-bold text-white">Add New Power Bracket</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <input required value={bName} onChange={(e) => setBName(e.target.value)} placeholder="Bracket Name" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white" />
                      <input required type="number" min={0} value={bMin} onChange={(e) => setBMin(e.target.value)} placeholder="Min SP" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white" />
                      <input type="number" min={0} value={bMax} onChange={(e) => setBMax(e.target.value)} placeholder="Max SP (blank = ∞)" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white" />
                    </div>
                    <button type="submit" disabled={busy} className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-500"><Plus className="h-3.5 w-3.5" /> Add Bracket</button>
                  </form>
                )}
              </>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runTournamentAction({
                action: "update_settings",
                description: editDesc,
                maps: editMaps.split(",").map((s) => s.trim()).filter(Boolean),
                scoring: editScoring,
                proofRequired: editProofReq,
                approvalRequired: editApprovalReq,
                allowDraws: editAllowDraws,
                prizes: { first: editFirstPrize.trim() || undefined, second: editSecondPrize.trim() || undefined, third: editThirdPrize.trim() || undefined },
              }, "Tournament configuration saved!");
            }}
            className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Rules, Maps &amp; Prizes</h2>
              {t.settingsLocked && <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">Locked</span>}
            </div>
            <textarea rows={2} disabled={t.settingsLocked} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-50" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select disabled={t.settingsLocked} value={editScoring} onChange={(e) => setEditScoring(e.target.value as TournamentScoring)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-50">
                {(Object.keys(SCORING_LABELS) as TournamentScoring[]).map((sc) => <option key={sc} value={sc}>{SCORING_LABELS[sc]}</option>)}
              </select>
              <input disabled={t.settingsLocked} value={editMaps} onChange={(e) => setEditMaps(e.target.value)} placeholder="Maps (comma-separated)" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-50" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input disabled={t.settingsLocked} value={editFirstPrize} onChange={(e) => setEditFirstPrize(e.target.value)} placeholder="1st Prize" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-50" />
              <input disabled={t.settingsLocked} value={editSecondPrize} onChange={(e) => setEditSecondPrize(e.target.value)} placeholder="2nd Prize" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-50" />
              <input disabled={t.settingsLocked} value={editThirdPrize} onChange={(e) => setEditThirdPrize(e.target.value)} placeholder="3rd Prize" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-50" />
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-300">
              <label className="flex items-center gap-2"><input type="checkbox" disabled={t.settingsLocked} checked={editProofReq} onChange={(e) => setEditProofReq(e.target.checked)} className="h-4 w-4 accent-indigo-500" /> Proof Required</label>
              <label className="flex items-center gap-2"><input type="checkbox" disabled={t.settingsLocked} checked={editApprovalReq} onChange={(e) => setEditApprovalReq(e.target.checked)} className="h-4 w-4 accent-indigo-500" /> Manager Approval</label>
              <label className="flex items-center gap-2"><input type="checkbox" disabled={t.settingsLocked} checked={editAllowDraws} onChange={(e) => setEditAllowDraws(e.target.checked)} className="h-4 w-4 accent-indigo-500" /> Allow Draws</label>
            </div>
            {!t.settingsLocked && (
              <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"><Save className="h-3.5 w-3.5" /> Save Configuration</button>
            )}
          </form>
        </div>
      )}

      {tab === "tickets" && (
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-10 text-center text-xs text-slate-400">No support tickets linked to this tournament.</div>
          ) : (
            tickets.map((tk) => (
              <div key={tk.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/65 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-indigo-300">{tk.category}</span>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-200">{tk.status}</span>
                    <span className="font-mono text-[10px] text-slate-500">User: {tk.userId}</span>
                  </div>
                  <p className="text-xs text-slate-300">{tk.description}</p>
                  {tk.resolution && <p className="text-[11px] text-emerald-300">Resolution: {tk.resolution}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {tk.status === "open" && <button type="button" disabled={busy} onClick={() => runTicketAction(tk.id, "claim")} className="rounded-xl bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white">Claim</button>}
                  {tk.status !== "closed" && (
                    <>
                      <button type="button" disabled={busy} onClick={() => runTicketAction(tk.id, "resolve", "Resolved via web dashboard")} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white">Resolve</button>
                      <button type="button" disabled={busy} onClick={() => runTicketAction(tk.id, "close", "Closed via web dashboard")} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-200">Close</button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "audit" && (
        <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/60">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/70 text-slate-400">
              <tr><th className="px-4 py-3">Timestamp</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Target</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {auditLogs.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No audit entries yet.</td></tr>
              ) : (
                auditLogs.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-slate-400">{a.createdAt ? new Date(a.createdAt).toLocaleString("en-IN") : "—"}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-indigo-300">{a.action}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-300">{a.actorId}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">{a.targetType} {a.targetId.slice(-8)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {proofModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setProofModal(null)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-700 bg-[#0b1120] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
              <div className="text-sm font-bold text-white">{proofModal.title}</div>
              <button type="button" onClick={() => setProofModal(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[75vh] overflow-auto bg-slate-950 p-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proofModal.url} alt={proofModal.title} className="mx-auto max-h-[65vh] rounded-2xl object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

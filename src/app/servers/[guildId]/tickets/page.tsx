"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  LifeBuoy,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import { ServerGuard } from "@/components/ServerGuard";
import { useWorkspace } from "@/components/WorkspaceContext";
import type { SupportTicketRow } from "@/lib/tournament-types";

const STATUS_BADGES: Record<string, string> = {
  open: "bg-emerald-500/15 text-emerald-300",
  claimed: "bg-indigo-500/15 text-indigo-300",
  awaiting_player: "bg-amber-500/15 text-amber-300",
  escalated: "bg-rose-500/15 text-rose-300",
  resolved: "bg-sky-500/15 text-sky-300",
  closed: "bg-slate-800 text-slate-400",
};

export default function ServerTicketsPage() {
  const params = useParams<{ guildId: string }>();
  const guildId = decodeURIComponent(params.guildId || "");
  const { serverData, refreshServer } = useWorkspace();

  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal state for note-requiring ticket actions
  const [modalAction, setModalAction] = useState<{
    ticket: SupportTicketRow;
    action: "awaiting_player" | "resolve" | "close" | "escalate" | "reopen";
    title: string;
    placeholder: string;
  } | null>(null);
  const [modalNote, setModalNote] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tickets?guildId=${encodeURIComponent(guildId)}`,
        { cache: "no-store", credentials: "include" }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not load support tickets.");
        return;
      }
      setTickets(j.tickets || []);
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    if (serverData?.access.canViewStaffTools) loadTickets();
  }, [serverData, loadTickets]);

  async function runTicketAction(
    ticketId: string,
    action: "claim" | "awaiting_player" | "resolve" | "close" | "escalate" | "reopen",
    note = ""
  ) {
    setBusyId(ticketId);
    setError(null);
    try {
      const res = await fetch("/api/tickets", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, action, note }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Ticket update failed.");
        return;
      }
      setModalAction(null);
      setModalNote("");
      showToast(`Ticket updated (${action.replace("_", " ")}) — synced to Discord!`);
      await Promise.all([loadTickets(), refreshServer()]);
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((tk) => {
      if (statusFilter === "active" && ["closed", "resolved"].includes(tk.status)) {
        return false;
      }
      if (
        statusFilter !== "all" &&
        statusFilter !== "active" &&
        tk.status !== statusFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        tk.description.toLowerCase().includes(q) ||
        tk.category.toLowerCase().includes(q) ||
        tk.userId.includes(q) ||
        tk.id.toLowerCase().includes(q)
      );
    });
  }, [tickets, statusFilter, search]);

  return (
    <ServerGuard guildId={guildId} requireStaff>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
              Support Tickets Desk
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Every action posts live updates and locks/renames the private
              Discord ticket channel automatically via WebSync.
            </p>
          </div>
          <button
            type="button"
            onClick={loadTickets}
            className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-200 hover:border-indigo-500 sm:self-center"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
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

        {/* Filter Bar */}
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by description, category, player ID, or ticket ID..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: "active", label: "Active" },
              { id: "all", label: `All (${tickets.length})` },
              { id: "open", label: "Open" },
              { id: "claimed", label: "Claimed" },
              { id: "escalated", label: "Escalated" },
              { id: "closed", label: "Closed" },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setStatusFilter(pill.id)}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  statusFilter === pill.id
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-800 bg-slate-950 text-slate-300 hover:border-indigo-500/50"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tickets List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-32 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-12 text-center">
            <LifeBuoy className="mx-auto mb-3 h-10 w-10 text-slate-500" />
            <h2 className="text-base font-bold text-white">No Tickets Found</h2>
            <p className="mt-1 text-xs text-slate-400">
              Players can open private tickets in Discord using{" "}
              <code className="text-indigo-400">/support create</code>.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((tk) => {
              const isClosed = tk.status === "closed";
              const busy = busyId === tk.id;
              return (
                <div
                  key={tk.id}
                  className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                            STATUS_BADGES[tk.status] || "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {tk.status.replace("_", " ")}
                        </span>
                        <span className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-300">
                          {tk.category}
                        </span>
                        <code className="font-mono text-[10px] text-slate-500">
                          #{tk.id.slice(-8)}
                        </code>
                        {tk.tournamentId && (
                          <Link
                            href={`/servers/${guildId}/tournaments/${tk.tournamentId}`}
                            className="text-[11px] font-bold text-indigo-400 hover:underline"
                          >
                            View Tournament →
                          </Link>
                        )}
                      </div>

                      <p className="text-xs leading-relaxed text-white">
                        {tk.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span>
                          Opened by Discord ID{" "}
                          <code className="font-mono text-slate-300">
                            {tk.userId}
                          </code>
                        </span>
                        {tk.claimedBy && (
                          <span>
                            · Claimed by{" "}
                            <code className="font-mono text-indigo-300">
                              {tk.claimedBy}
                            </code>
                          </span>
                        )}
                        {tk.createdAt && (
                          <span>
                            · {new Date(tk.createdAt).toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>

                      {tk.resolution && (
                        <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                          <strong>Resolution: </strong>
                          {tk.resolution}
                        </div>
                      )}
                    </div>

                    {/* Staff Actions */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!isClosed ? (
                        <>
                          {["open", "awaiting_player"].includes(tk.status) && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => runTicketAction(tk.id, "claim")}
                              className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              Claim
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setModalNote("");
                              setModalAction({
                                ticket: tk,
                                action: "awaiting_player",
                                title: "Mark Awaiting Player",
                                placeholder: "Optional message to post in Discord...",
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:border-amber-500/50"
                          >
                            <Clock className="h-3.5 w-3.5 text-amber-400" />
                            Wait
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setModalNote("");
                              setModalAction({
                                ticket: tk,
                                action: "resolve",
                                title: "Resolve Ticket",
                                placeholder: "Enter resolution summary...",
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Resolve
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setModalNote("");
                              setModalAction({
                                ticket: tk,
                                action: "escalate",
                                title: "Escalate Ticket",
                                placeholder: "Reason for escalating to head staff...",
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/15 px-3 py-1.5 text-[11px] font-bold text-amber-300"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Escalate
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setModalNote("");
                              setModalAction({
                                ticket: tk,
                                action: "close",
                                title: "Close & Lock Ticket",
                                placeholder: "Final closing note...",
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-300"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            Close
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setModalNote("");
                            setModalAction({
                              ticket: tk,
                              action: "reopen",
                              title: "Reopen Closed Ticket",
                              placeholder: "Reason for reopening...",
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:border-indigo-500"
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-indigo-400" />
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Action Note Modal */}
        {modalAction && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() => setModalAction(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md space-y-4 rounded-3xl border border-slate-700 bg-[#0b1120] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-white">
                  {modalAction.title}
                </h2>
                <button
                  type="button"
                  onClick={() => setModalAction(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                rows={3}
                value={modalNote}
                onChange={(e) => setModalNote(e.target.value)}
                placeholder={modalAction.placeholder}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAction(null)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busyId === modalAction.ticket.id}
                  onClick={() =>
                    runTicketAction(
                      modalAction.ticket.id,
                      modalAction.action,
                      modalNote.trim()
                    )
                  }
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-extrabold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ServerGuard>
  );
}

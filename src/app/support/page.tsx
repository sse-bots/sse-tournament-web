"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { LifeBuoy, Plus, Hash, ExternalLink, ArrowLeft } from "lucide-react";
import { SupportTicketDTO, TICKET_CATEGORIES } from "@/lib/types";
import { useArena } from "@/components/theme-provider";
import { useToast } from "@/components/ui/toast";
import { AuthGuard } from "@/components/auth-guard";

const TICKET_FILTERS = [
  "all",
  "open",
  "claimed",
  "awaiting_player",
  "escalated",
  "resolved",
  "closed",
];

function SupportDeskContent() {
  const { activeGuildId } = useArena();
  const { push } = useToast();
  const [tickets, setTickets] = useState<SupportTicketDTO[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [category, setCategory] = useState("match");
  const [guildId, setGuildId] = useState(activeGuildId);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeGuildId) setGuildId(activeGuildId);
  }, [activeGuildId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (activeGuildId) p.set("guildId", activeGuildId);
      if (statusFilter !== "all") p.set("status", statusFilter);
      const res = await fetch(`/api/support?${p.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } finally {
      setLoading(false);
    }
  }, [activeGuildId, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, category, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create ticket");
      push("Support ticket opened!", "success");
      setDescription("");
      await load();
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function updateTicket(ticketId: string, action: string) {
    const note = ["resolve", "close", "reopen", "escalate"].includes(action)
      ? window.prompt(`Enter note / resolution for ${action}:`) || ""
      : "";
    const res = await fetch(`/api/support/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    const data = await res.json();
    if (!res.ok) return push(data.error || "Update failed", "error");
    push(`Ticket updated (${action.replace("_", " ")}).`, "success");
    await load();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      <div className="space-y-1.5">
        <Link
          href={activeGuildId ? `/dashboard/${activeGuildId}` : "/dashboard"}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--arena-muted)] hover:text-amber-500"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </Link>
        <h1 className="font-display-caps text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5">
          <LifeBuoy className="h-6 w-6 sm:h-7 sm:w-7 text-cyan-500 shrink-0" /> Support & Dispute Desk
        </h1>
        <p className="text-xs sm:text-sm text-[var(--arena-muted)]">
          Synced live with <code>/support</code> tickets from SSE Tournament Bot.
        </p>
      </div>

      <form onSubmit={createTicket} className="arena-card p-4 sm:p-5 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold uppercase text-[var(--arena-muted)]">Category</label>
            <select
              className="arena-input mt-1"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
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
        </div>
        <textarea
          rows={2}
          className="arena-input"
          placeholder="Describe your registration, team, or match dispute issue..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <button type="submit" disabled={busy} className="arena-btn-primary text-xs w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Open Ticket
        </button>
      </form>

      <div className="flex overflow-x-auto gap-1.5 pb-1">
        {TICKET_FILTERS.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-bold uppercase ${
              statusFilter === st
                ? "border-amber-500 bg-amber-500/15 text-amber-500"
                : "border-[var(--arena-border)] bg-[var(--arena-surface)] text-[var(--arena-muted)]"
            }`}
          >
            {st.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="arena-card p-8 text-center text-sm text-[var(--arena-muted)]">
            Loading tickets...
          </div>
        ) : tickets.length === 0 ? (
          <div className="arena-card p-8 text-center text-sm text-[var(--arena-muted)]">
            No support tickets found.
          </div>
        ) : (
          tickets.map((tk) => (
            <div key={tk._id} className="arena-card p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-500">
                    {tk.category}
                  </span>
                  <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-500">
                    {tk.status.replace("_", " ")}
                  </span>
                  <span className="font-mono text-xs text-[var(--arena-muted)]">
                    User: {tk.userId}
                  </span>
                </div>
                {tk.channelId && (
                  <a
                    href={`https://discord.com/channels/${tk.guildId}/${tk.channelId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-indigo-400 flex items-center gap-1 hover:underline"
                  >
                    <Hash className="h-3.5 w-3.5" /> Discord Channel{" "}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <p className="text-sm">{tk.description}</p>
              {tk.resolution && (
                <div className="text-xs text-emerald-500">Resolution: {tk.resolution}</div>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--arena-border)]">
                {tk.status === "open" && (
                  <button
                    type="button"
                    onClick={() => updateTicket(tk._id, "claim")}
                    className="arena-btn-secondary text-xs py-1 px-2.5"
                  >
                    Claim
                  </button>
                )}
                {tk.status !== "closed" && (
                  <>
                    <button
                      type="button"
                      onClick={() => updateTicket(tk._id, "awaiting_player")}
                      className="arena-btn-secondary text-xs py-1 px-2.5"
                    >
                      Awaiting Player
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTicket(tk._id, "escalate")}
                      className="arena-btn-secondary text-xs py-1 px-2.5"
                    >
                      Escalate
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTicket(tk._id, "resolve")}
                      className="arena-btn-primary text-xs py-1 px-2.5"
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTicket(tk._id, "close")}
                      className="arena-btn-danger text-xs py-1 px-2.5"
                    >
                      Close
                    </button>
                  </>
                )}
                {tk.status === "closed" && (
                  <button
                    type="button"
                    onClick={() => updateTicket(tk._id, "reopen")}
                    className="arena-btn-secondary text-xs py-1 px-2.5"
                  >
                    Reopen
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function SupportDeskPage() {
  return (
    <AuthGuard>
      <SupportDeskContent />
    </AuthGuard>
  );
}

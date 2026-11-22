"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Bot, RefreshCw, CheckCircle2, AlertTriangle, Radio } from "lucide-react";
import { useToast } from "./ui/toast";

interface Props {
  tournamentId: string;
  guildId: string;
  canManage: boolean;
}

export function BotSyncBar({ tournamentId, guildId, canManage }: Props) {
  const { push } = useToast();
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [missingChannels, setMissingChannels] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/sync?guildId=${encodeURIComponent(guildId)}&tournamentId=${encodeURIComponent(tournamentId)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setPending(Number(data.pending || 0));
      setFailed(Number(data.failed || 0));
      setMissingChannels(Number(data.missingChannels || 0));
    } catch {
      // silent background poll
    }
  }, [guildId, tournamentId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 12000);
    return () => clearInterval(timer);
  }, [load]);

  async function triggerSync(action: "sync_channels" | "retry_failed") {
    setBusy(true);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, tournamentId, guildId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync trigger failed");
      push(
        action === "retry_failed"
          ? `Re-queued ${data.retried} failed Discord sync job(s).`
          : data.message || "Discord sync queued.",
        "success"
      );
      await load();
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="arena-card px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Bot className="h-4 w-4 text-cyan-500 shrink-0" />
        <span className="font-bold uppercase tracking-wider text-[var(--arena-text)]">
          Discord Bot Sync
        </span>

        {pending > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 border border-cyan-500/35 px-2.5 py-0.5 font-semibold text-cyan-500">
            <Radio className="h-3 w-3 animate-pulse" /> {pending} syncing...
          </span>
        ) : failed > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/35 px-2.5 py-0.5 font-semibold text-red-500">
            <AlertTriangle className="h-3 w-3" /> {failed} failed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 px-2.5 py-0.5 font-semibold text-emerald-500">
            <CheckCircle2 className="h-3 w-3" /> In Sync
          </span>
        )}

        {missingChannels > 0 && (
          <span className="text-amber-500 font-semibold">
            • {missingChannels} match post(s) awaiting Discord channel
          </span>
        )}
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          {failed > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => triggerSync("retry_failed")}
              className="arena-btn-danger py-1 px-2.5 text-[11px]"
            >
              Retry Failed
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => triggerSync("sync_channels")}
            className="arena-btn-secondary py-1 px-2.5 text-[11px]"
          >
            <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
            Sync Match Channels
          </button>
        </div>
      )}
    </div>
  );
}

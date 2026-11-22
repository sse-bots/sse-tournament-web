"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ScrollText, ArrowLeft, RefreshCw } from "lucide-react";
import { AuditLogDTO } from "@/lib/types";
import { useArena } from "@/components/theme-provider";
import { AuthGuard } from "@/components/auth-guard";

function AuditContent() {
  const { activeGuildId } = useArena();
  const [logs, setLogs] = useState<AuditLogDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/audit?limit=60${activeGuildId ? `&guildId=${encodeURIComponent(activeGuildId)}` : ""}`
      );
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } finally {
      setLoading(false);
    }
  }, [activeGuildId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Link
            href={activeGuildId ? `/dashboard/${activeGuildId}` : "/dashboard"}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--arena-muted)] hover:text-amber-500"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </Link>
          <h1 className="font-display-caps text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5">
            <ScrollText className="h-6 w-6 sm:h-7 sm:w-7 text-amber-500 shrink-0" /> Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-[var(--arena-muted)]">
            Unified log of Discord bot commands and Web Arena actions across tournaments, brackets, squads, and match verifications.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="arena-btn-secondary text-xs w-full sm:w-auto shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="arena-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--arena-elevated)] uppercase tracking-wider text-[var(--arena-muted)]">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Timestamp</th>
                <th className="px-4 py-3 whitespace-nowrap">Action</th>
                <th className="px-4 py-3 whitespace-nowrap">Actor</th>
                <th className="px-4 py-3 whitespace-nowrap">Target</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--arena-border)] font-mono">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--arena-muted)]">
                    Loading audit logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--arena-muted)]">
                    No audit logs yet.
                  </td>
                </tr>
              ) : (
                logs.map((row) => (
                  <tr key={row._id} className="hover:bg-[var(--arena-elevated)]/40">
                    <td className="px-4 py-2.5 whitespace-nowrap text-[var(--arena-muted)]">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-amber-500 whitespace-nowrap">
                      {row.action}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{row.actorId}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {row.targetType} {row.targetId ? `(${row.targetId.slice(-6)})` : ""}
                    </td>
                    <td className="px-4 py-2.5 max-w-xs sm:max-w-md truncate text-[var(--arena-muted)]">
                      {JSON.stringify(row.details || {})}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AuditPage() {
  return (
    <AuthGuard>
      <AuditContent />
    </AuthGuard>
  );
}

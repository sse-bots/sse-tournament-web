"use client";

import React, { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { AuditLogDTO } from "@/lib/types";
import { useArena } from "@/components/theme-provider";

export default function AuditPage() {
  const { activeGuildId } = useArena();
  const [logs, setLogs] = useState<AuditLogDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/audit?limit=60${activeGuildId ? `&guildId=${encodeURIComponent(activeGuildId)}` : ""}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeGuildId]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
      <div>
        <h1 className="font-display-caps text-3xl font-extrabold flex items-center gap-2.5">
          <ScrollText className="h-7 w-7 text-amber-500" /> Audit Trail
        </h1>
        <p className="text-sm text-[var(--arena-muted)] mt-1">
          Unified log of Discord bot commands and Web Arena actions across tournaments, brackets, squads, and match verifications.
        </p>
      </div>

      <div className="arena-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--arena-elevated)] uppercase tracking-wider text-[var(--arena-muted)]">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--arena-border)] font-mono">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--arena-muted)]">Loading audit logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--arena-muted)]">No audit logs yet.</td></tr>
              ) : logs.map((row) => (
                <tr key={row._id} className="hover:bg-[var(--arena-elevated)]/40">
                  <td className="px-4 py-2.5 whitespace-nowrap text-[var(--arena-muted)]">{new Date(row.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-bold text-amber-500">{row.action}</td>
                  <td className="px-4 py-2.5">{row.actorId}</td>
                  <td className="px-4 py-2.5">{row.targetType} {row.targetId ? `(${row.targetId.slice(-6)})` : ""}</td>
                  <td className="px-4 py-2.5 max-w-md truncate text-[var(--arena-muted)]">{JSON.stringify(row.details || {})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

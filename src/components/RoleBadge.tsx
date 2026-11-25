"use client";

import { Crown, Lock, ShieldCheck, User } from "lucide-react";
import type { ServerAccessRole } from "@/lib/tournament-types";

export function RoleBadge({
  role,
  label,
  compact = false,
}: {
  role: ServerAccessRole;
  label?: string;
  compact?: boolean;
}) {
  if (role === "owner") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 font-bold text-amber-300 ${
          compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]"
        }`}
      >
        <Crown className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        {label || "Server Owner"}
      </span>
    );
  }
  if (role === "moderator") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-indigo-500/40 bg-indigo-500/15 font-bold text-indigo-300 ${
          compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]"
        }`}
      >
        <ShieldCheck className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        {label || "Moderator"}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 font-semibold text-slate-300 ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]"
      }`}
    >
      <User className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {label || "Member"}
    </span>
  );
}

export function FairPlayBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-300">
      <Lock className="h-2.5 w-2.5" />
      Fair-Play Locked
    </span>
  );
}

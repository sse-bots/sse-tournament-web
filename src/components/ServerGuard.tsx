"use client";

import Link from "next/link";
import { ArrowLeft, Lock, LogIn, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { useWorkspace } from "@/components/WorkspaceContext";

export function ServerGuard({
  guildId,
  requireOwner = false,
  requireStaff = false,
  children,
}: {
  guildId: string;
  requireOwner?: boolean;
  requireStaff?: boolean;
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const { serverData, serverLoading, serverError } = useWorkspace();

  if (authLoading || (serverLoading && !serverData)) {
    return (
      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="h-32 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60" />
          <div className="h-32 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60" />
          <div className="h-32 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-3xl border border-slate-800 bg-slate-900/75 p-8 text-center shadow-2xl">
        <LogIn className="mx-auto mb-3 h-10 w-10 text-indigo-400" />
        <h1 className="text-lg font-extrabold text-white">Sign In Required</h1>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Sign in with your <strong className="text-white">SSE Account</strong>{" "}
          to enter this server workspace.
        </p>
        <Link
          href={`/api/auth/login?next=${encodeURIComponent(`/servers/${guildId}`)}`}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500"
        >
          <LogIn className="h-4 w-4" />
          Sign In with SSE Accounts
        </Link>
      </div>
    );
  }

  if (serverError || !serverData) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-3xl border border-rose-500/40 bg-slate-900/75 p-8 text-center shadow-2xl">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-rose-400" />
        <h1 className="text-lg font-extrabold text-white">Access Unavailable</h1>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          {serverError || "You do not have access to this Discord server workspace."}
        </p>
        <Link
          href="/servers"
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:border-indigo-500"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Main Menu
        </Link>
      </div>
    );
  }

  if (requireOwner && !serverData.access.isServerOwner) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-3xl border border-amber-500/40 bg-slate-900/75 p-8 text-center shadow-2xl">
        <Lock className="mx-auto mb-3 h-10 w-10 text-amber-400" />
        <h1 className="text-lg font-extrabold text-white">Server Owner Only</h1>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Only the Discord Server Owner of{" "}
          <strong className="text-white">{serverData.settings.guildName}</strong>{" "}
          can access this section.
        </p>
        <Link
          href={`/servers/${guildId}`}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Server Overview
        </Link>
      </div>
    );
  }

  if (requireStaff && !serverData.access.canViewStaffTools) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-3xl border border-amber-500/40 bg-slate-900/75 p-8 text-center shadow-2xl">
        <Lock className="mx-auto mb-3 h-10 w-10 text-amber-400" />
        <h1 className="text-lg font-extrabold text-white">Staff Access Required</h1>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          This section is restricted to the Server Owner and assigned Tournament
          Moderators.
        </p>
        <Link
          href={`/servers/${guildId}`}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Server Overview
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

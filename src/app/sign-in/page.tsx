"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LogIn, ShieldAlert, ShieldCheck, Swords } from "lucide-react";
import { SITE_SETTINGS } from "@/lib/site-settings";

function SignInInner() {
  const params = useSearchParams();
  const error = params.get("error");
  const nextPath = params.get("next") || "/servers";

  return (
    <div className="mx-auto mt-8 max-w-md">
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/75 shadow-2xl">
        <div className="sse-arena-hero border-b border-slate-800/80 px-6 py-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
            <Swords className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-white">Sign in to {SITE_SETTINGS.siteName}</h1>
          <p className="mt-1.5 text-xs text-slate-400">
            Authenticate securely with your centralized <strong className="text-white">SSE Account</strong> to manage tournaments, verify squad power, and review match proofs.
          </p>
        </div>

        <div className="space-y-4 p-6">
          {error && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-300">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Link
            href={`/api/auth/login?next=${encodeURIComponent(nextPath)}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500"
          >
            <LogIn className="h-4 w-4" />
            Continue with SSE Accounts
          </Link>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-[11px] leading-relaxed text-slate-400">
            <div className="flex items-center gap-1.5 font-bold text-slate-200">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Why SSE Accounts SSO?
            </div>
            <p className="mt-1">
              Your linked Discord server list, SSE roles, and 2-Step protection sync seamlessly from{" "}
              <a href={SITE_SETTINGS.links.accountsUrl} target="_blank" rel="noreferrer" className="font-semibold text-indigo-400 underline">
                SSE Accounts
              </a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs text-slate-400">Loading...</div>}>
      <SignInInner />
    </Suspense>
  );
}

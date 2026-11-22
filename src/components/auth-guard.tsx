"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Lock, ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";
import { useArena } from "./theme-provider";
import { signInWithNexus } from "@/lib/auth-client";
import { useToast } from "./ui/toast";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { actor, loadingActor } = useArena();
  const pathname = usePathname();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setBusy(true);
    try {
      await signInWithNexus(pathname || "/dashboard");
    } catch (err) {
      push((err as Error).message, "error");
      setBusy(false);
    }
  }

  if (loadingActor) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 space-y-4">
        <div className="h-28 rounded-2xl arena-card animate-pulse bg-[var(--arena-elevated)]/60" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl arena-card animate-pulse bg-[var(--arena-elevated)]/40" />
          ))}
        </div>
      </div>
    );
  }

  if (!actor) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="arena-card p-6 sm:p-8 text-center space-y-5 shadow-arena">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/15 text-amber-500">
            <Lock className="h-7 w-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display-caps text-2xl font-extrabold">SSE Nexus Login Required</h1>
            <p className="text-xs sm:text-sm text-[var(--arena-muted)] leading-relaxed">
              Sign in with your SSE Nexus profile to inspect your Discord servers, create or join tournaments, and manage matches.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleLogin}
            className="arena-btn-primary w-full py-3 shadow-glowGold"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{busy ? "Redirecting to SSE Nexus..." : "Login with SSE Nexus"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--arena-muted)] hover:text-amber-500"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

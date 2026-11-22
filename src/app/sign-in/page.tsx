"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, Trophy, ArrowRight } from "lucide-react";
import { signInWithNexus } from "@/lib/auth-client";

function SignInCard() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setBusy(true);
    try {
      await signInWithNexus(nextPath);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="arena-card p-8 text-center space-y-6 shadow-arena">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-glowGold">
          <Trophy className="h-8 w-8 stroke-[2.5]" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display-caps text-2xl font-extrabold">SSE Nexus Single Sign-On</h1>
          <p className="text-sm text-[var(--arena-muted)]">
            Authenticate through <strong>SSE Nexus OAuth</strong> to register for tournaments, manage teams, submit match proof, and review results with your linked Discord identity.
          </p>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={handleLogin}
          className="arena-btn-primary w-full py-3 text-sm shadow-glowGold"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>{busy ? "Redirecting to SSE Nexus..." : "Continue with SSE Nexus"}</span>
          <ArrowRight className="h-4 w-4" />
        </button>

        <div className="rounded-lg bg-[var(--arena-elevated)] p-3 text-[11px] text-[var(--arena-muted)] leading-relaxed">
          Uses Better Auth OAuth 2.0 + PKCE against your SSE Nexus identity provider. No separate password required.
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-[var(--arena-muted)]">Loading sign-in...</div>}>
      <SignInCard />
    </Suspense>
  );
}

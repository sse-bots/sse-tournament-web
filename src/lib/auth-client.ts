"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});

export async function signInWithNexus(callbackURL: string = "/dashboard") {
  const res = await fetch("/api/auth/sign-in/oauth2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      providerId: "sse-nexus",
      callbackURL,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    url?: string;
    message?: string;
    error?: string;
  };

  if (!res.ok || !data.url) {
    throw new Error(data.message || data.error || "Could not start SSE Nexus login.");
  }

  window.location.href = data.url;
}

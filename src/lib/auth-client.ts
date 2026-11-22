"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});

export async function signInWithNexus(callbackURL: string = "/") {
  return authClient.signIn.social({
    provider: "sse-nexus",
    callbackURL,
  });
}

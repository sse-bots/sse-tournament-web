import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  decryptCookiePayload,
  encryptCookiePayload,
  getAccountsBaseUrl,
  getAppBaseUrl,
  getCookieSecurityOptions,
  isGlobalAdminUser,
  type StoredSession,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OAuthStatePayload {
  state: string;
  verifier: string;
  nextPath: string;
  createdAt: number;
}

export async function GET(req: Request) {
  const appBase = getAppBaseUrl();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const fail = (msg: string) => {
    const res = NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(msg)}`, appBase)
    );
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  };

  if (oauthError) {
    return fail(
      searchParams.get("error_description") ||
        `SSE Accounts sign-in cancelled (${oauthError}).`
    );
  }
  if (!code || !state) {
    return fail("Missing authorization code or state from SSE Accounts.");
  }

  const jar = await cookies();
  const rawState = jar.get(OAUTH_STATE_COOKIE)?.value;
  const saved = rawState
    ? decryptCookiePayload<OAuthStatePayload>(rawState)
    : null;

  if (!saved || saved.state !== state) {
    return fail("Sign-in session expired or state mismatch. Please try again.");
  }

  const clientId = (process.env.SSE_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = (process.env.SSE_OAUTH_CLIENT_SECRET || "").trim();
  const redirectUri = `${appBase}/api/auth/callback`;
  const accountsBase = getAccountsBaseUrl();

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: saved.verifier,
  });

  const tokenHeaders: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  if (clientSecret) {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    tokenHeaders.Authorization = `Basic ${basic}`;
  }

  const tokenRes = await fetch(`${accountsBase}/api/auth/oauth2/token`, {
    method: "POST",
    headers: tokenHeaders,
    body: tokenBody.toString(),
    cache: "no-store",
  });

  if (!tokenRes.ok) {
    return fail("Could not exchange SSE Accounts authorization code.");
  }

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  if (!tokenData.access_token) {
    return fail("SSE Accounts did not return an access token.");
  }

  const userRes = await fetch(`${accountsBase}/api/auth/oauth2/userinfo`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!userRes.ok) {
    return fail("Could not load your SSE Accounts profile.");
  }

  const claims = (await userRes.json()) as Record<string, unknown>;
  const sub = String(claims.sub || "");
  if (!sub) return fail("Invalid SSE Accounts user payload.");

  const discordId =
    typeof claims.discord_id === "string" ? claims.discord_id : null;
  const sseRoles = Array.isArray(claims.sse_roles)
    ? claims.sse_roles.map(String)
    : [];
  const ssePermissions = Array.isArray(claims.sse_permissions)
    ? claims.sse_permissions.map(String)
    : [];
  const sseBadges = Array.isArray(claims.sse_badges)
    ? claims.sse_badges.map(String)
    : [];

  const sessionPayload: StoredSession = {
    user: {
      sub,
      name: String(claims.name || claims.username || "SSE Player"),
      username: typeof claims.username === "string" ? claims.username : null,
      email: typeof claims.email === "string" ? claims.email : null,
      image: typeof claims.picture === "string" ? claims.picture : null,
      discordId,
      discordUsername:
        typeof claims.discord_username === "string"
          ? claims.discord_username
          : null,
      sseRole: typeof claims.sse_role === "string" ? claims.sse_role : "member",
      sseRoles,
      ssePermissions,
      sseBadges,
      sseVerified: Boolean(claims.sse_verified),
      isGlobalAdmin: isGlobalAdminUser(discordId, sseRoles, ssePermissions),
    },
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 14,
  };

  const target =
    saved.nextPath && saved.nextPath.startsWith("/")
      ? saved.nextPath
      : "/servers";

  const res = NextResponse.redirect(new URL(target, appBase));
  res.cookies.delete(OAUTH_STATE_COOKIE);
  res.cookies.set(
    SESSION_COOKIE,
    encryptCookiePayload(sessionPayload),
    getCookieSecurityOptions(60 * 60 * 24 * 14)
  );
  return res;
}

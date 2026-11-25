import crypto from "crypto";
import { cookies } from "next/headers";
import type { SessionUser } from "./tournament-types";

export const SESSION_COOKIE = "sse_tourney_session";
export const OAUTH_STATE_COOKIE = "sse_tourney_oauth_state";

export interface StoredSession {
  user: SessionUser;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: number;
}

export interface DiscordGuildRaw {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

function normalizeUrl(raw?: string | null): string {
  const cleaned = (raw || "").trim().replace(/\/+$/, "");
  if (!cleaned) return "";
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

export function getAccountsBaseUrl(): string {
  return (
    normalizeUrl(process.env.SSE_ACCOUNTS_URL) ||
    normalizeUrl(process.env.NEXT_PUBLIC_SSE_ACCOUNTS_URL) ||
    "https://sse-account.vercel.app"
  );
}

export function getAppBaseUrl(): string {
  return (
    normalizeUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeUrl(process.env.VERCEL_URL) ||
    "http://localhost:3000"
  );
}

function getSessionSecret(): Buffer {
  const raw =
    (process.env.SESSION_SECRET || "").trim() ||
    (process.env.SSE_OAUTH_CLIENT_SECRET || "").trim() ||
    "sse-tournament-dev-fallback-secret-change-in-production";
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptCookiePayload(data: unknown): string {
  const key = getSessionSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptCookiePayload<T>(token: string): T | null {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 29) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const key = getSessionSecret();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function createPkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

export function isGlobalAdminUser(
  discordId: string | null | undefined,
  sseRoles: string[],
  ssePermissions: string[]
): boolean {
  const envAdmins = new Set(
    (process.env.ADMIN_DISCORD_IDS || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
  );
  if (discordId && envAdmins.has(String(discordId))) return true;
  if (
    sseRoles.includes("head") ||
    sseRoles.includes("admin") ||
    sseRoles.includes("tournament_manager")
  ) {
    return true;
  }
  return (
    ssePermissions.includes("*") ||
    ssePermissions.includes("tournaments:manage") ||
    ssePermissions.includes("accounts:admin")
  );
}

export async function getSession(): Promise<StoredSession | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const session = decryptCookiePayload<StoredSession>(raw);
  if (!session || !session.user?.sub) return null;
  if (session.expiresAt && Date.now() > session.expiresAt) return null;
  return session;
}

export function hasManageGuildPermission(guild: DiscordGuildRaw): boolean {
  if (guild.owner) return true;
  try {
    const perms = BigInt(guild.permissions || "0");
    const ADMINISTRATOR = BigInt(0x8);
    const MANAGE_GUILD = BigInt(0x20);
    return (perms & ADMINISTRATOR) === ADMINISTRATOR || (perms & MANAGE_GUILD) === MANAGE_GUILD;
  } catch {
    return false;
  }
}

export async function fetchUserDiscordGuilds(
  accessToken: string
): Promise<DiscordGuildRaw[]> {
  if (!accessToken) return [];
  const accountsUrl = getAccountsBaseUrl();
  try {
    const res = await fetch(`${accountsUrl}/api/sso/discord/guilds`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { guilds?: DiscordGuildRaw[] };
    return Array.isArray(data.guilds) ? data.guilds : [];
  } catch {
    return [];
  }
}

export function getCookieSecurityOptions(maxAgeSeconds: number) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

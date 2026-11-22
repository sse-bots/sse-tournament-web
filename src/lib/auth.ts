import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { genericOAuth } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { getDbSync, getMongoClient } from "./mongo";

const nexusBase = (process.env.NEXUS_BASE_URL || "https://sse-nexus.vercel.app").replace(/\/+$/, "");
const appUrl = (
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");

const nexusScopes = (process.env.NEXUS_OAUTH_SCOPES || "openid profile email")
  .split(/[\s,]+/)
  .map((s) => s.trim())
  .filter(Boolean);

function createAuthInstance() {
  const hasMongo = Boolean(process.env.MONGODB_URI);
  const database = hasMongo
    ? mongodbAdapter(getDbSync(), { client: getMongoClient() })
    : undefined;

  return betterAuth({
    baseURL: appUrl,
    secret:
      process.env.BETTER_AUTH_SECRET ||
      "dev-only-fallback-secret-replace-in-production-32chars",
    database,
    trustedOrigins: [appUrl, nexusBase],
    user: {
      additionalFields: {
        discordId: {
          type: "string",
          required: false,
          defaultValue: "",
        },
        nexusRole: {
          type: "string",
          required: false,
          defaultValue: "player",
        },
        roleIdsJson: {
          type: "string",
          required: false,
          defaultValue: "[]",
        },
      },
    },
    plugins: [
      genericOAuth({
        config: [
          {
            providerId: "sse-nexus",
            clientId: process.env.NEXUS_OAUTH_CLIENT_ID || "sse-tournament-client",
            clientSecret: process.env.NEXUS_OAUTH_CLIENT_SECRET || "sse-tournament-secret",
            discoveryUrl: process.env.NEXUS_OAUTH_DISCOVERY_URL || undefined,
            authorizationUrl:
              process.env.NEXUS_OAUTH_AUTHORIZATION_URL ||
              `${nexusBase}/api/auth/oauth2/authorize`,
            tokenUrl:
              process.env.NEXUS_OAUTH_TOKEN_URL ||
              `${nexusBase}/api/auth/oauth2/token`,
            userInfoUrl:
              process.env.NEXUS_OAUTH_USERINFO_URL ||
              `${nexusBase}/api/auth/oauth2/userinfo`,
            scopes: nexusScopes,
            pkce: true,
            mapProfileToUser: (profile) => {
              const raw = profile as unknown as Record<string, unknown>;
              const discordId = String(
                raw.discordId || raw.discord_id || raw.sub || raw.id || ""
              );
              const roleList = Array.isArray(raw.roleIds)
                ? raw.roleIds.map(String)
                : Array.isArray(raw.roles)
                  ? raw.roles.map(String)
                  : [];
              const nexusRole = String(raw.role || raw.nexusRole || "player");
              return {
                name: String(raw.name || raw.username || raw.global_name || "SSE Competitor"),
                email: String(raw.email || `${discordId || "player"}@sse-nexus.local`),
                image: raw.image
                  ? String(raw.image)
                  : raw.picture
                    ? String(raw.picture)
                    : raw.avatar
                      ? String(raw.avatar)
                      : undefined,
                emailVerified: Boolean(raw.email_verified ?? true),
                discordId,
                nexusRole,
                roleIdsJson: JSON.stringify(roleList),
              };
            },
          },
        ],
      }),
      nextCookies(),
    ],
  });
}

const globalForAuth = globalThis as unknown as {
  _sseBetterAuth?: ReturnType<typeof createAuthInstance>;
};

export function getAuth() {
  if (!globalForAuth._sseBetterAuth) {
    globalForAuth._sseBetterAuth = createAuthInstance();
  }
  return globalForAuth._sseBetterAuth;
}

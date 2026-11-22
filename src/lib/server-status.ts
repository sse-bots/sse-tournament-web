import { getCollections, getMongoClient } from "./mongo";

export type ServerReadiness = "active" | "needs_activation" | "not_installed";

export interface ServerStatusInfo {
  guildId: string;
  name: string;
  iconUrl: string | null;
  botInstalled: boolean;
  activationStatus: "active" | "inactive" | "unregistered" | "unknown";
  setupComplete: boolean;
  readiness: ServerReadiness;
  counts: {
    tournaments: number;
    live: number;
    openReg: number;
    games: number;
  };
}

interface DiscordGuildBrief {
  id: string;
  name: string;
  icon: string | null;
}

export function getBotInviteUrl(guildId?: string): string {
  const explicit = process.env.NEXT_PUBLIC_BOT_INVITE_URL?.trim();
  if (explicit) {
    if (guildId && !explicit.includes("guild_id=")) {
      const sep = explicit.includes("?") ? "&" : "?";
      return `${explicit}${sep}guild_id=${encodeURIComponent(guildId)}`;
    }
    return explicit;
  }
  const clientId =
    process.env.NEXT_PUBLIC_BOT_CLIENT_ID?.trim() ||
    process.env.DISCORD_CLIENT_ID?.trim() ||
    "";
  if (!clientId) return "https://sse-nexus.vercel.app";
  // Manage Channels, Manage Roles, Send Messages, Attach Files, Read History, Embed Links
  const permissions = "268486672";
  const base = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&permissions=${permissions}&scope=bot%20applications.commands`;
  return guildId ? `${base}&guild_id=${encodeURIComponent(guildId)}` : base;
}

async function fetchBotDiscordGuilds(): Promise | null> {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) return null;

  try {
    const res = await fetch("https://discord.com/api/v10/users/@me/guilds?limit=200", {
      headers: { Authorization: `Bot ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as DiscordGuildBrief[];
    const map = new Map<string, DiscordGuildBrief>();
    for (const g of rows) {
      if (g?.id) map.set(String(g.id), g);
    }
    return map;
  } catch (err) {
    console.error("[server-status] Discord guild fetch failed:", err);
    return null;
  }
}

async function fetchActivationStatusMap(): Promise | null> {
  const botActivationId = process.env.BOT_ACTIVATION_ID?.trim();
  if (!botActivationId) return null;

  try {
    const client = getMongoClient();
    await client.connect();
    const dbName =
      process.env.ACTIVATION_DB_NAME?.trim() ||
      process.env.MONGODB_DB_NAME?.trim() ||
      "sse_bot_hub";
    const actDb = client.db(dbName);
    const colName = process.env.ACTIVATION_COLLECTION?.trim() || "server_activations";
    const col = actDb.collection(colName);

    const docs = await col
      .find({
        $or: [
          { botActivationId },
          { botId: botActivationId },
          { bot_activation_id: botActivationId },
        ],
      })
      .toArray();

    const map = new Map<string, "active" | "inactive">();
    for (const d of docs) {
      const gid = String(d.guildId || d.serverId || d.guild_id || "").trim();
      if (!gid) continue;
      const rawStatus = String(d.status || "").toLowerCase();
      const isActive =
        rawStatus === "active" ||
        (rawStatus === "" && Boolean(d.active ?? d.isActive));
      map.set(gid, isActive ? "active" : "inactive");
    }
    return map;
  } catch (err) {
    console.error("[server-status] Activation lookup failed:", err);
    return null;
  }
}

export async function inspectServers(requestedGuildId?: string | null): Promise<ServerStatusInfo[]> {
  const { guildConfig, tournaments, games } = await getCollections();

  const [botGuilds, activationMap, configs, tGuilds, gGuilds] = await Promise.all([
    fetchBotDiscordGuilds(),
    fetchActivationStatusMap(),
    guildConfig.find({}).toArray(),
    tournaments.distinct("guildId"),
    games.distinct("guildId"),
  ]);

  const configMap = new Map(configs.map((c) => [String(c.guildId), c]));
  const allIds = new Set<string>();

  if (requestedGuildId && /^\d{17,20}$/.test(requestedGuildId.trim())) {
    allIds.add(requestedGuildId.trim());
  } else {
    if (process.env.DEFAULT_GUILD_ID?.trim()) allIds.add(process.env.DEFAULT_GUILD_ID.trim());
    if (botGuilds) {
      for (const gid of botGuilds.keys()) allIds.add(gid);
    }
    if (activationMap) {
      for (const gid of activationMap.keys()) allIds.add(gid);
    }
    for (const c of configs) if (c.guildId) allIds.add(String(c.guildId));
    for (const gid of tGuilds) if (gid) allIds.add(String(gid));
    for (const gid of gGuilds) if (gid) allIds.add(String(gid));
  }

  const results = await Promise.all(
    Array.from(allIds).map(async (guildId): Promise<ServerStatusInfo> => {
      const dg = botGuilds?.get(guildId) || null;
      const cfg = configMap.get(guildId) || null;

      const [tCount, liveCount, openCount, gameCount] = await Promise.all([
        tournaments.countDocuments({ guildId, status: { $ne: "archived" } }),
        tournaments.countDocuments({ guildId, status: "in_progress" }),
        tournaments.countDocuments({ guildId, status: "registration" }),
        games.countDocuments({ guildId, active: true }),
      ]);

      const setupComplete = Boolean(cfg?.categoryId);
      const hasDbPresence = setupComplete || tCount > 0 || gameCount > 0;

      // Determine Bot Installation
      const botInstalled = botGuilds ? Boolean(dg) : hasDbPresence;

      // Determine Activation Status
      let activationStatus: ServerStatusInfo["activationStatus"] = "unknown";
      if (activationMap) {
        activationStatus = activationMap.get(guildId) || "unregistered";
      } else if (botInstalled) {
        activationStatus = "active";
      } else {
        activationStatus = "unregistered";
      }

      // Compute Readiness Badge
      let readiness: ServerReadiness = "not_installed";
      if (!botInstalled) {
        readiness = "not_installed";
      } else if (activationStatus === "active") {
        readiness = "active";
      } else {
        readiness = "needs_activation";
      }

      const iconUrl =
        dg?.icon
          ? `https://cdn.discordapp.com/icons/${dg.id}/${dg.icon}.png?size=128`
          : null;

      return {
        guildId,
        name: dg?.name || (cfg?.guildName ? String(cfg.guildName) : `Discord Server ${guildId.slice(-6)}`),
        iconUrl,
        botInstalled,
        activationStatus,
        setupComplete,
        readiness,
        counts: {
          tournaments: tCount,
          live: liveCount,
          openReg: openCount,
          games: gameCount,
        },
      };
    })
  );

  // Sort active servers first, then by tournament count
  const rank: Record<ServerReadiness, number> = {
    active: 0,
    needs_activation: 1,
    not_installed: 2,
  };
  results.sort(
    (a, b) => rank[a.readiness] - rank[b.readiness] || b.counts.tournaments - a.counts.tournaments
  );

  return results;
}

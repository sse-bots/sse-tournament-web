import { NextResponse } from "next/server";
import {
  fetchUserDiscordGuilds,
  getSession,
  hasManageGuildPermission,
} from "@/lib/auth";
import { getCollections } from "@/lib/mongodb";
import type { ManagedGuild } from "@/lib/tournament-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ guildConfig, tournaments, games }, discordGuilds] =
    await Promise.all([
      getCollections(),
      fetchUserDiscordGuilds(session.accessToken),
    ]);

  const guildMap = new Map<string, ManagedGuild>();

  for (const g of discordGuilds) {
    const canManage =
      session.user.isGlobalAdmin || hasManageGuildPermission(g);
    if (!canManage) continue;
    const iconUrl = g.icon
      ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`
      : null;
    guildMap.set(String(g.id), {
      id: String(g.id),
      name: g.name,
      icon: iconUrl,
      owner: Boolean(g.owner),
      canManage: true,
      botConfigured: false,
      tournamentCount: 0,
      gameCount: 0,
    });
  }

  const dbGuildQuery = session.user.isGlobalAdmin
    ? {}
    : session.user.discordId
      ? { ownerId: session.user.discordId }
      : { ownerId: session.user.sub };

  const ownedTourneys = await tournaments
    .find(dbGuildQuery, { projection: { guildId: 1 } })
    .toArray();
  for (const t of ownedTourneys) {
    const gid = String(t.guildId || "");
    if (gid && !guildMap.has(gid)) {
      guildMap.set(gid, {
        id: gid,
        name: `Discord Server (${gid.slice(-6)})`,
        icon: null,
        owner: false,
        canManage: true,
        botConfigured: false,
        tournamentCount: 0,
        gameCount: 0,
      });
    }
  }

  const guildIds = Array.from(guildMap.keys());
  if (guildIds.length > 0) {
    const [configs, tourneyAgg, gameAgg] = await Promise.all([
      guildConfig.find({ guildId: { $in: guildIds } }).toArray(),
      tournaments
        .aggregate([
          { $match: { guildId: { $in: guildIds }, status: { $ne: "archived" } } },
          { $group: { _id: "$guildId", count: { $sum: 1 } } },
        ])
        .toArray(),
      games
        .aggregate([
          { $match: { guildId: { $in: guildIds }, active: true } },
          { $group: { _id: "$guildId", count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);

    const configuredSet = new Set(configs.map((c) => String(c.guildId)));
    const tCountMap = new Map(
      tourneyAgg.map((r) => [String(r._id), Number(r.count)])
    );
    const gCountMap = new Map(
      gameAgg.map((r) => [String(r._id), Number(r.count)])
    );

    for (const [gid, item] of guildMap.entries()) {
      item.botConfigured = configuredSet.has(gid) || (tCountMap.get(gid) || 0) > 0;
      item.tournamentCount = tCountMap.get(gid) || 0;
      item.gameCount = gCountMap.get(gid) || 0;
    }
  }

  const list = Array.from(guildMap.values()).sort(
    (a, b) =>
      Number(b.botConfigured) - Number(a.botConfigured) ||
      b.tournamentCount - a.tournamentCount ||
      a.name.localeCompare(b.name)
  );

  return NextResponse.json(
    { guilds: list },
    { headers: { "Cache-Control": "no-store" } }
  );
}

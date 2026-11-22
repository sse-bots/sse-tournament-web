import { NextResponse } from "next/server";
import { getCollections, serializeDocs } from "@/lib/mongo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { guildConfig, tournaments, games } = await getCollections();
    const configs = await guildConfig.find({}).toArray();
    const tGuilds = await tournaments.distinct("guildId");
    const gGuilds = await games.distinct("guildId");
    const idSet = new Set<string>();
    if (process.env.DEFAULT_GUILD_ID) idSet.add(process.env.DEFAULT_GUILD_ID);
    for (const c of configs) if (c.guildId) idSet.add(String(c.guildId));
    for (const id of tGuilds) if (id) idSet.add(String(id));
    for (const id of gGuilds) if (id) idSet.add(String(id));

    const configMap = new Map(configs.map((c) => [String(c.guildId), serializeDocs([c])[0]]));
    const guilds = Array.from(idSet).map((guildId) => ({
      guildId,
      config: configMap.get(guildId) || null,
    }));
    return NextResponse.json({
      guilds,
      defaultGuildId: process.env.DEFAULT_GUILD_ID || guilds[0]?.guildId || "",
    });
  } catch (err) {
    console.error("[api/guilds]", err);
    return NextResponse.json(
      { guilds: [], defaultGuildId: process.env.DEFAULT_GUILD_ID || "", error: "Database unavailable" },
      { status: 200 }
    );
  }
}

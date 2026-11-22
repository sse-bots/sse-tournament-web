import { NextRequest, NextResponse } from "next/server";
import { getCollections, serializeDocs, serializeDoc, writeAudit } from "@/lib/mongo";
import { getSessionActor } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { games } = await getCollections();
    const guildId = req.nextUrl.searchParams.get("guildId");
    const query: Record<string, unknown> = { active: true };
    if (guildId) query.guildId = guildId;
    const rows = await games.find(query).sort({ name: 1 }).limit(100).toArray();
    return NextResponse.json({ games: serializeDocs(rows) });
  } catch (err) {
    console.error("[api/games GET]", err);
    return NextResponse.json({ games: [], error: "Could not load games." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ error: "Sign in with SSE Nexus required." }, { status: 401 });

  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const guildId = String(body.guildId || actor.activeGuildId || "").trim();
    if (!name) return NextResponse.json({ error: "Game name is required." }, { status: 400 });
    if (!guildId) return NextResponse.json({ error: "Discord Server (Guild) ID is required." }, { status: 400 });

    const { games } = await getCollections();
    const existing = await games.findOne({ guildId, nameLower: name.toLowerCase(), active: true });
    if (existing) {
      return NextResponse.json({ error: "That game already exists in this server." }, { status: 409 });
    }
    const doc = {
      guildId,
      name,
      nameLower: name.toLowerCase(),
      createdBy: actor.discordId,
      active: true,
      createdAt: new Date(),
    };
    const res = await games.insertOne(doc);
    await writeAudit(guildId, actor.discordId, "game.create", "Game", res.insertedId, { name });
    return NextResponse.json({ game: serializeDoc({ ...doc, _id: res.insertedId }) }, { status: 201 });
  } catch (err) {
    console.error("[api/games POST]", err);
    return NextResponse.json({ error: "Could not create game." }, { status: 500 });
  }
}

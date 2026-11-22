import { NextRequest, NextResponse } from "next/server";
import { getCollections, toObjectId, writeAudit } from "@/lib/mongo";
import { getSessionActor } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid game ID." }, { status: 400 });

  const body = await req.json();
  const newName = String(body.name || "").trim();
  if (!newName) return NextResponse.json({ error: "New game name is required." }, { status: 400 });

  const { games } = await getCollections();
  const game = await games.findOne({ _id: oid, active: true });
  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });

  const conflict = await games.findOne({
    _id: { $ne: oid },
    guildId: game.guildId,
    nameLower: newName.toLowerCase(),
    active: true,
  });
  if (conflict) return NextResponse.json({ error: "Another game already uses that name." }, { status: 409 });

  await games.updateOne(
    { _id: oid },
    { $set: { name: newName, nameLower: newName.toLowerCase(), updatedAt: new Date() } }
  );
  await writeAudit(String(game.guildId), actor.discordId, "game.edit", "Game", oid, {
    from: game.name,
    to: newName,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid game ID." }, { status: 400 });

  const { games } = await getCollections();
  const game = await games.findOne({ _id: oid, active: true });
  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });

  await games.updateOne({ _id: oid }, { $set: { active: false, updatedAt: new Date() } });
  await writeAudit(String(game.guildId), actor.discordId, "game.delete", "Game", oid, {
    name: game.name,
  });
  return NextResponse.json({ ok: true });
}

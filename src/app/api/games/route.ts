import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getCollections, toIso, toObjectId, writeAuditLog } from "@/lib/mongodb";
import { resolveServerAccess } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createGameSchema = z.object({
  guildId: z.string().trim().min(5),
  name: z.string().trim().min(2).max(60),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const guildId = (searchParams.get("guildId") || "").trim();

  const { games } = await getCollections();
  const filter: Record<string, unknown> = { active: true };
  if (guildId) filter.guildId = guildId;

  const docs = await games.find(filter).sort({ name: 1 }).limit(100).toArray();
  return NextResponse.json({
    games: docs.map((g) => ({
      id: String(g._id),
      guildId: String(g.guildId || ""),
      name: String(g.name || ""),
      active: Boolean(g.active),
      createdBy: String(g.createdBy || ""),
      createdAt: toIso(g.createdAt),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createGameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid game data." },
      { status: 400 }
    );
  }

  const { guildId, name } = parsed.data;
  const allowed = (await resolveServerAccess(session, guildId)).access.canManageGames;
  if (!allowed) {
    return NextResponse.json(
      { error: "You do not have Manage Server permission for this guild." },
      { status: 403 }
    );
  }

  const { games } = await getCollections();
  const nameLower = name.toLowerCase();
  const existing = await games.findOne({ guildId, nameLower });
  if (existing && existing.active) {
    return NextResponse.json({ error: `Game "${name}" already exists.` }, { status: 409 });
  }

  const actorId = session.user.discordId || session.user.sub;
  if (existing && !existing.active) {
    await games.updateOne(
      { _id: existing._id },
      { $set: { active: true, name, updatedAt: new Date() } }
    );
    await writeAuditLog({ guildId, actorId, action: "game.create", targetType: "Game", targetId: String(existing._id), details: { name, reactivated: true } });
    return NextResponse.json({ ok: true, id: String(existing._id) }, { status: 201 });
  }

  const result = await games.insertOne({
    guildId,
    name,
    nameLower,
    createdBy: actorId,
    active: true,
    createdAt: new Date(),
  });

  await writeAuditLog({ guildId, actorId, action: "game.create", targetType: "Game", targetId: String(result.insertedId), details: { name } });
  return NextResponse.json({ ok: true, id: String(result.insertedId) }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = (searchParams.get("id") || "").trim();
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Valid game id required." }, { status: 400 });

  const { games } = await getCollections();
  const game = await games.findOne({ _id: oid });
  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });

  const allowed = (await resolveServerAccess(session, String(game.guildId))).access.canManageGames;
  if (!allowed) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  await games.updateOne({ _id: oid }, { $set: { active: false, updatedAt: new Date() } });
  await writeAuditLog({ guildId: String(game.guildId), actorId: session.user.discordId || session.user.sub, action: "game.delete", targetType: "Game", targetId: id, details: { name: game.name } });
  return NextResponse.json({ ok: true });
}

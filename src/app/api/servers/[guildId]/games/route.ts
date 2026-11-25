import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getCollections, toIso, toObjectId, writeAuditLog } from "@/lib/mongodb";
import { resolveServerAccess } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createGameSchema = z.object({
  name: z.string().trim().min(2, "Game name must be at least 2 characters.").max(60),
});

const patchGameSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(60),
});

export async function GET(
  _req: Request,
  context: { params: Promise<{ guildId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { guildId } = await context.params;
  const { access } = await resolveServerAccess(session, guildId);
  if (!access.isMember) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { games, tournaments } = await getCollections();
  const [docs, tAgg] = await Promise.all([
    games.find({ guildId, active: true }).sort({ name: 1 }).limit(100).toArray(),
    tournaments
      .aggregate([
        { $match: { guildId, status: { $ne: "archived" } } },
        { $group: { _id: "$gameId", count: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const countMap = new Map(tAgg.map((r) => [String(r._id), Number(r.count)]));

  return NextResponse.json(
    {
      access,
      games: docs.map((g) => ({
        id: String(g._id),
        guildId: String(g.guildId || ""),
        name: String(g.name || ""),
        active: Boolean(g.active),
        createdBy: String(g.createdBy || ""),
        tournamentCount: countMap.get(String(g._id)) || 0,
        createdAt: toIso(g.createdAt),
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(
  req: Request,
  context: { params: Promise<{ guildId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { guildId } = await context.params;
  const { access } = await resolveServerAccess(session, guildId);
  if (!access.canManageGames) {
    return NextResponse.json(
      { error: "Only the Discord Server Owner can add games." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = createGameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid game name." },
      { status: 400 }
    );
  }

  const { games } = await getCollections();
  const name = parsed.data.name;
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

  const res = await games.insertOne({
    guildId,
    name,
    nameLower,
    createdBy: actorId,
    active: true,
    createdAt: new Date(),
  });
  await writeAuditLog({ guildId, actorId, action: "game.create", targetType: "Game", targetId: String(res.insertedId), details: { name } });
  return NextResponse.json({ ok: true, id: String(res.insertedId) }, { status: 201 });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ guildId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { guildId } = await context.params;
  const { access } = await resolveServerAccess(session, guildId);
  if (!access.canManageGames) {
    return NextResponse.json(
      { error: "Only the Discord Server Owner can edit games." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = patchGameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload." }, { status: 400 });
  }

  const oid = toObjectId(parsed.data.id);
  if (!oid) return NextResponse.json({ error: "Invalid game ID." }, { status: 400 });

  const { games } = await getCollections();
  const existing = await games.findOne({ _id: oid, guildId, active: true });
  if (!existing) return NextResponse.json({ error: "Game not found." }, { status: 404 });

  const name = parsed.data.name;
  const conflict = await games.findOne({
    guildId,
    nameLower: name.toLowerCase(),
    _id: { $ne: oid },
  });
  if (conflict) {
    return NextResponse.json({ error: `Another game named "${name}" already exists.` }, { status: 409 });
  }

  await games.updateOne(
    { _id: oid },
    { $set: { name, nameLower: name.toLowerCase(), updatedAt: new Date() } }
  );
  await writeAuditLog({
    guildId,
    actorId: session.user.discordId || session.user.sub,
    action: "game.edit",
    targetType: "Game",
    targetId: String(oid),
    details: { from: existing.name, to: name },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ guildId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { guildId } = await context.params;
  const { access } = await resolveServerAccess(session, guildId);
  if (!access.canManageGames) {
    return NextResponse.json(
      { error: "Only the Discord Server Owner can remove games." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const oid = toObjectId(searchParams.get("id") || "");
  if (!oid) return NextResponse.json({ error: "Valid game id required." }, { status: 400 });

  const { games } = await getCollections();
  const existing = await games.findOne({ _id: oid, guildId });
  if (!existing) return NextResponse.json({ error: "Game not found." }, { status: 404 });

  await games.updateOne({ _id: oid }, { $set: { active: false, updatedAt: new Date() } });
  await writeAuditLog({
    guildId,
    actorId: session.user.discordId || session.user.sub,
    action: "game.delete",
    targetType: "Game",
    targetId: String(oid),
    details: { name: existing.name },
  });
  return NextResponse.json({ ok: true });
}

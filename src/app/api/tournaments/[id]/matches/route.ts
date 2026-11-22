import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections, toObjectId, serializeDoc, serializeDocs, writeAudit } from "@/lib/mongo";
import { getSessionActor, canManageTournament } from "@/lib/permissions";
import { enqueueBotEvent } from "@/lib/bot-sync";
import { createMatchRecord, teamVerifiedPower, EntrantSeed } from "@/lib/tournament-engine";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });
  const { matches, teams } = await getCollections();
  const [matchDocs, teamDocs] = await Promise.all([
    matches.find({ tournamentId: oid }).sort({ roundNumber: 1, matchNumber: 1 }).toArray(),
    teams.find({ tournamentId: oid }).toArray(),
  ]);
  const teamMap = new Map(teamDocs.map((tm) => [String(tm._id), String(tm.name)]));
  const out = serializeDocs(matchDocs).map((m) => ({
    ...m,
    sideATeamName: m.sideATeamId ? teamMap.get(String(m.sideATeamId)) || null : null,
    sideBTeamName: m.sideBTeamId ? teamMap.get(String(m.sideBTeamId)) || null : null,
  }));
  return NextResponse.json({ matches: out });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });
  const tournamentOid = oid;

  const { tournaments, registrations, teams, matches } = await getCollections();
  const t = await tournaments.findOne({ _id: tournamentOid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const actor = await getSessionActor(String(t.guildId));
  const check = await canManageTournament(actor, t);
  if (!check.allowed) return NextResponse.json({ error: check.reason }, { status: 403 });

  if (!["registration_closed", "matchmaking", "in_progress"].includes(String(t.status))) {
    return NextResponse.json(
      { error: "Close registration before creating manual matches." },
      { status: 409 }
    );
  }

  const body = await req.json();
  const sideARaw = String(body.sideA || "").trim();
  const sideBRaw = String(body.sideB || "").trim();
  const mapName = String(body.mapName || "").trim();
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  const bracketId = toObjectId(body.bracketId);

  if (t.bracketsEnabled && !bracketId) {
    return NextResponse.json({ error: "Select a bracket for this match." }, { status: 400 });
  }

  async function resolveSide(raw: string): Promise<EntrantSeed> {
    if (t!.mode === "team") {
      const byId = toObjectId(raw);
      const tm = byId
        ? await teams.findOne({ _id: byId, tournamentId: tournamentOid, status: "active" })
        : await teams.findOne({
            tournamentId: tournamentOid,
            nameLower: raw.toLowerCase(),
            status: "active",
          });
      if (!tm) throw new Error(`Active team "${raw}" not found.`);
      return {
        ids: (Array.isArray(tm.memberIds) ? tm.memberIds : []).map((x: unknown) => String(x)),
        teamId: tm._id as ObjectId,
        power: await teamVerifiedPower(t!, tm),
        bracketId,
      };
    }
    const ids = raw
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (!ids.length) throw new Error("Enter registered Discord User ID(s).");
    for (const uid of ids) {
      const r = await registrations.findOne({
        tournamentId: tournamentOid,
        userId: uid,
        status: "registered",
      });
      if (!r) throw new Error(`Player ${uid} is not registered.`);
    }
    return { ids, teamId: null, power: 0, bracketId };
  }

  let a: EntrantSeed;
  let b: EntrantSeed;
  try {
    a = await resolveSide(sideARaw);
    b = await resolveSide(sideBRaw);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  if (a.ids.some((u: string) => b.ids.includes(u))) {
    return NextResponse.json(
      { error: "A player cannot be assigned to both sides." },
      { status: 400 }
    );
  }

  const last = await matches
    .find({ tournamentId: tournamentOid })
    .sort({ matchNumber: -1 })
    .limit(1)
    .toArray();
  const nextNo = (last[0]?.matchNumber || 0) + 1;
  const roundNo = Number(body.roundNumber || last[0]?.roundNumber || 1);

  const created = await createMatchRecord(t, a, b, nextNo, roundNo, bracketId);
  const createdId: ObjectId = created._id;
  const updates: Record<string, unknown> = {};
  if (mapName) updates.mapName = mapName;
  if (scheduledAt && !Number.isNaN(scheduledAt.getTime())) {
    const deadlineHrs = Number(t.schedule?.matchDeadlineHours || 48);
    updates.scheduledAt = scheduledAt;
    updates.deadlineAt = new Date(scheduledAt.getTime() + deadlineHrs * 3600 * 1000);
  }
  if (Object.keys(updates).length) {
    await matches.updateOne({ _id: createdId }, { $set: updates });
  }

  await writeAudit(String(t.guildId), actor!.discordId, "match.create", "Match", createdId, {
    sideA: a.ids,
    sideB: b.ids,
    mapName,
  });

  await enqueueBotEvent({
    guildId: String(t.guildId),
    type: "match.sync_channels",
    actorId: actor!.discordId,
    tournamentId: tournamentOid,
    matchId: createdId,
  });

  const finalDoc = await matches.findOne({ _id: createdId });
  return NextResponse.json({ match: serializeDoc(finalDoc) }, { status: 201 });
}

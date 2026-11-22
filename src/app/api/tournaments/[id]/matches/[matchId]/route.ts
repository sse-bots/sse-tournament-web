import { NextRequest, NextResponse } from "next/server";
import { getCollections, toObjectId, serializeDoc, serializeDocs, writeAudit } from "@/lib/mongo";
import { getSessionActor, canManageTournament, canReviewTournamentResult } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  const { id, matchId } = await params;
  const tid = toObjectId(id);
  const mid = toObjectId(matchId);
  if (!tid || !mid) return NextResponse.json({ error: "Invalid IDs." }, { status: 400 });

  const { tournaments, matches, teams, registrations, auditLogs, games } = await getCollections();
  const [t, m] = await Promise.all([
    tournaments.findOne({ _id: tid }),
    matches.findOne({ _id: mid, tournamentId: tid }),
  ]);
  if (!t || !m) return NextResponse.json({ error: "Match post not found." }, { status: 404 });

  const [game, teamA, teamB, regs, history, actor, seriesMatches] = await Promise.all([
    games.findOne({ _id: t.gameId }),
    m.sideATeamId ? teams.findOne({ _id: m.sideATeamId }) : null,
    m.sideBTeamId ? teams.findOne({ _id: m.sideBTeamId }) : null,
    registrations
      .find({ tournamentId: tid, userId: { $in: [...(m.sideAUserIds || []), ...(m.sideBUserIds || [])] } })
      .toArray(),
    auditLogs.find({ targetType: "Match", targetId: mid.toHexString() }).sort({ createdAt: -1 }).limit(40).toArray(),
    getSessionActor(String(t.guildId)),
    m.seriesId ? matches.find({ seriesId: m.seriesId }).sort({ seriesIndex: 1 }).toArray() : Promise.resolve([]),
  ]);

  const manageCheck = await canManageTournament(actor, t);
  const reviewCheck = await canReviewTournamentResult(actor, t);
  const participantIds = [...(m.sideAUserIds || []), ...(m.sideBUserIds || [])].map(String);
  const isParticipant = Boolean(actor && participantIds.includes(actor.discordId));

  return NextResponse.json({
    tournament: { ...serializeDoc(t), gameName: game?.name || "Unknown Game" },
    match: {
      ...serializeDoc(m),
      sideATeamName: teamA?.name || null,
      sideBTeamName: teamB?.name || null,
    },
    teamA: serializeDoc(teamA),
    teamB: serializeDoc(teamB),
    participants: serializeDocs(regs),
    seriesMatches: serializeDocs(seriesMatches),
    history: serializeDocs(history),
    permissions: {
      isParticipant,
      canManage: manageCheck.allowed,
      canReview: reviewCheck.allowed && !isParticipant,
      isBotAdmin: Boolean(actor?.isBotAdmin),
      discordId: actor?.discordId || null,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  const { id, matchId } = await params;
  const tid = toObjectId(id);
  const mid = toObjectId(matchId);
  if (!tid || !mid) return NextResponse.json({ error: "Invalid IDs." }, { status: 400 });

  const { tournaments, matches } = await getCollections();
  const [t, m] = await Promise.all([
    tournaments.findOne({ _id: tid }),
    matches.findOne({ _id: mid, tournamentId: tid }),
  ]);
  if (!t || !m) return NextResponse.json({ error: "Match not found." }, { status: 404 });

  const actor = await getSessionActor(String(t.guildId));
  const check = await canManageTournament(actor, t);
  if (!check.allowed) return NextResponse.json({ error: check.reason }, { status: 403 });

  if (["approved", "forfeited", "cancelled"].includes(String(m.status))) {
    return NextResponse.json({ error: "Finalized matches cannot be edited or rescheduled." }, { status: 409 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = { editedBy: actor!.discordId, editedAt: new Date() };

  if (body.mapName !== undefined && String(body.mapName).trim()) {
    updates.mapName = String(body.mapName).trim();
  }
  if (body.channelId !== undefined) {
    updates.channelId = String(body.channelId).trim() || null;
  }
  if (body.scheduledAt) {
    const when = new Date(body.scheduledAt);
    if (Number.isNaN(when.getTime())) return NextResponse.json({ error: "Invalid schedule timestamp." }, { status: 400 });
    const deadlineHrs = Number(t.schedule?.matchDeadlineHours || 48);
    updates.scheduledAt = when;
    updates.deadlineAt = body.deadlineAt
      ? new Date(body.deadlineAt)
      : new Date(when.getTime() + deadlineHrs * 3600 * 1000);
    updates.rescheduleReason = String(body.reason || "Updated via Web Arena");
    updates.rescheduledBy = actor!.discordId;
    updates.rescheduledAt = new Date();
  } else if (body.deadlineAt) {
    const dl = new Date(body.deadlineAt);
    if (!Number.isNaN(dl.getTime())) updates.deadlineAt = dl;
  }

  if (body.status && ["scheduled", "ready", "in_progress", "pending_proof", "postponed"].includes(String(body.status))) {
    updates.status = body.status;
    updates.statusNote = String(body.note || "");
    updates.statusChangedAt = new Date();
    updates.statusChangedBy = actor!.discordId;
  }

  await matches.updateOne({ _id: mid }, { $set: updates });
  await writeAudit(String(t.guildId), actor!.discordId, "match.edit", "Match", mid, updates);
  const fresh = await matches.findOne({ _id: mid });
  return NextResponse.json({ match: serializeDoc(fresh) });
}

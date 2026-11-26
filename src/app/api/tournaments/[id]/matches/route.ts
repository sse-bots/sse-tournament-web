import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getCollections, toObjectId, writeAuditLog } from "@/lib/mongodb";
import { resolveTournamentAccess } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createMatchSchema = z.object({
  sideAId: z.string().trim().min(1),
  sideBId: z.string().trim().min(1),
  mapName: z.string().trim().max(80).optional().default(""),
  bracketId: z.string().trim().optional().nullable(),
  weekNumber: z.number().int().min(1).max(52).optional(),
  roundNumber: z.number().int().min(1).max(30).optional().default(1),
  scheduledAt: z.string().trim().optional().nullable(),
});

const matchActionSchema = z.object({
  matchId: z.string().min(1),
  action: z.enum(["approve", "reject", "dispute", "forfeit", "override", "set_status", "edit"]),
  winnerSide: z.enum(["A", "B", "DRAW"]).optional(),
  status: z.enum(["scheduled", "ready", "in_progress", "pending_proof", "postponed"]).optional(),
  mapName: z.string().trim().max(80).optional(),
  scheduledAt: z.string().trim().optional(),
  note: z.string().trim().max(240).optional().default(""),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await context.params;
  const tid = toObjectId(id);
  if (!tid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });

  const { tournaments, matches, registrations, teams } = await getCollections();
  const t = await tournaments.findOne({ _id: tid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const { access } = await resolveTournamentAccess(session, t);
  if (!access.canManageTournament) {
    return NextResponse.json({ error: "Moderator or Owner permission required." }, { status: 403 });
  }

  if (!["registration_closed", "matchmaking", "in_progress"].includes(String(t.status))) {
    return NextResponse.json({ error: "Close registration before creating manual matches." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createMatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid custom match payload." }, { status: 400 });
  }

  const d = parsed.data;
  if (d.sideAId === d.sideBId) {
    return NextResponse.json({ error: "Side A and Side B must be different entrants." }, { status: 400 });
  }

  let sideAUserIds: string[] = [];
  let sideBUserIds: string[] = [];
  let sideATeamId = null;
  let sideBTeamId = null;
  let sideALabel = "";
  let sideBLabel = "";

  if (t.mode === "team") {
    const [tmA, tmB] = await Promise.all([
      teams.findOne({ _id: toObjectId(d.sideAId) || undefined, tournamentId: tid, status: "active" }),
      teams.findOne({ _id: toObjectId(d.sideBId) || undefined, tournamentId: tid, status: "active" }),
    ]);
    if (!tmA || !tmB) {
      return NextResponse.json({ error: "Both selected teams must be active in this tournament." }, { status: 400 });
    }
    sideAUserIds = Array.isArray(tmA.memberIds) ? tmA.memberIds.map(String) : [];
    sideBUserIds = Array.isArray(tmB.memberIds) ? tmB.memberIds.map(String) : [];
    sideATeamId = tmA._id;
    sideBTeamId = tmB._id;
    sideALabel = String(tmA.name || "Team A");
    sideBLabel = String(tmB.name || "Team B");
  } else {
    const [regA, regB] = await Promise.all([
      registrations.findOne({ tournamentId: tid, userId: d.sideAId, status: "registered" }),
      registrations.findOne({ tournamentId: tid, userId: d.sideBId, status: "registered" }),
    ]);
    if (!regA || !regB) {
      return NextResponse.json({ error: "Both players must be registered in this tournament." }, { status: 400 });
    }
    sideAUserIds = [String(regA.userId)];
    sideBUserIds = [String(regB.userId)];
    sideALabel = String(regA.inGameId || regA.discordDisplayName || regA.discordUsername || `Player #${String(regA.userId).slice(-4)}`);
    sideBLabel = String(regB.inGameId || regB.discordDisplayName || regB.discordUsername || `Player #${String(regB.userId).slice(-4)}`);
  }

  const lastDoc = await matches
    .find({ tournamentId: tid })
    .sort({ matchNumber: -1 })
    .limit(1)
    .next();
  const nextNumber = Number(lastDoc?.matchNumber ?? 0) + 1;

  const existingWeeks = Array.isArray(t.weeks)
    ? (t.weeks as Array<Record<string, unknown>>).map((w) => Number(w.weekNumber ?? 0))
    : [];
  const weekNumber = d.weekNumber || Math.max(1, ...existingWeeks, Number(lastDoc?.weekNumber ?? 1));

  const existingInWeek = await matches
    .find({ tournamentId: tid, weekNumber })
    .project({ weekMatchNumber: 1 })
    .toArray();
  const maxWeekMatch = existingInWeek.reduce(
    (mx, item) => Math.max(mx, Number(item.weekMatchNumber ?? 0)),
    existingInWeek.length
  );
  const weekMatchNumber = maxWeekMatch + 1;

  const maps = Array.isArray(t.maps) && t.maps.length > 0 ? t.maps.map(String) : ["To be announced"];
  const mapName = d.mapName || maps[(weekMatchNumber - 1) % maps.length];

  let bracketObjId = null;
  if (d.bracketId && Array.isArray(t.brackets)) {
    const foundB = t.brackets.find((b: { _id: unknown }) => String(b._id) === d.bracketId);
    if (foundB) bracketObjId = foundB._id;
  }

  const now = new Date();
  const doc: Record<string, unknown> = {
    guildId: String(t.guildId),
    tournamentId: tid,
    matchNumber: nextNumber,
    weekMatchNumber,
    weekNumber,
    bracketId: bracketObjId,
    sideAUserIds,
    sideBUserIds,
    sideATeamId,
    sideBTeamId,
    sideALabel,
    sideBLabel,
    sideAPower: 0,
    sideBPower: 0,
    mapName,
    format: String(t.format),
    roundNumber: d.roundNumber,
    status: "scheduled",
    forumTag: "pending",
    createdAt: now,
  };

  if (d.scheduledAt) {
    const dt = new Date(d.scheduledAt);
    if (!Number.isNaN(dt.getTime())) {
      doc.scheduledAt = dt;
      const deadlineHrs = Number(((t.schedule || {}) as Record<string, unknown>).matchDeadlineHours ?? 48);
      doc.deadlineAt = new Date(dt.getTime() + deadlineHrs * 3600_000);
    }
  }

  const inserted = await matches.insertOne(doc);

  if (!existingWeeks.includes(weekNumber)) {
    await tournaments.updateOne(
      { _id: tid },
      {
        $push: {
          weeks: {
            weekNumber,
            status: "open",
            forumChannelId: null,
            forumUrl: null,
            announcementThreadId: null,
            announcementThreadUrl: null,
            isForum: true,
            tagIds: {},
            createdAt: now,
          },
        } as never,
      }
    );
  }

  await writeAuditLog({
    guildId: String(t.guildId),
    actorId: session.user.discordId || session.user.sub,
    action: "match.web_create",
    targetType: "Match",
    targetId: String(inserted.insertedId),
    details: { matchNumber: nextNumber, weekMatchNumber, weekNumber, sideALabel, sideBLabel, mapName },
  });

  return NextResponse.json(
    { ok: true, id: String(inserted.insertedId), matchNumber: nextNumber, weekMatchNumber, weekNumber },
    { status: 201 }
  );
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await context.params;
  const tid = toObjectId(id);
  if (!tid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = matchActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid match payload." }, { status: 400 });

  const { tournaments, matches, registrations } = await getCollections();
  const t = await tournaments.findOne({ _id: tid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const { access } = await resolveTournamentAccess(session, t);
  if (!access.canManageTournament) {
    return NextResponse.json(
      {
        error: access.isFairPlayLocked
          ? "Fair-Play Guard: registered participants cannot review matches in this tournament."
          : "Moderator or Owner permission required.",
      },
      { status: 403 }
    );
  }

  const mid = toObjectId(parsed.data.matchId);
  if (!mid) return NextResponse.json({ error: "Invalid match ID." }, { status: 400 });
  const m = await matches.findOne({ _id: mid, tournamentId: tid });
  if (!m) return NextResponse.json({ error: "Match not found." }, { status: 404 });

  const actorId = session.user.discordId || session.user.sub;
  const now = new Date();
  const sideAIds = Array.isArray(m.sideAUserIds) ? m.sideAUserIds.map(String) : [];
  const sideBIds = Array.isArray(m.sideBUserIds) ? m.sideBUserIds.map(String) : [];

  if (session.user.discordId && [...sideAIds, ...sideBIds].includes(String(session.user.discordId))) {
    return NextResponse.json({ error: "You cannot review your own match." }, { status: 403 });
  }

  const sideLabel = (side: "A" | "B" | "DRAW") =>
    side === "DRAW"
      ? "Draw"
      : side === "A"
        ? String(m.sideALabel || "Side A")
        : String(m.sideBLabel || "Side B");

  async function applyScore(side: "A" | "B" | "DRAW", delta: 1 | -1) {
    if (side === "DRAW") {
      for (const uid of [...sideAIds, ...sideBIds]) {
        await registrations.updateOne({ tournamentId: tid, userId: uid }, { $inc: { points: delta } });
      }
      return;
    }
    const winners = side === "A" ? sideAIds : sideBIds;
    const losers = side === "A" ? sideBIds : sideAIds;
    for (const uid of winners) await registrations.updateOne({ tournamentId: tid, userId: uid }, { $inc: { wins: delta, points: 3 * delta } });
    for (const uid of losers) await registrations.updateOne({ tournamentId: tid, userId: uid }, { $inc: { losses: delta } });
  }

  const { action, winnerSide, status, mapName, scheduledAt, note } = parsed.data;

  if (action === "approve") {
    if (!["pending_review", "disputed"].includes(String(m.status))) {
      return NextResponse.json({ error: "Only pending or disputed matches can be approved." }, { status: 400 });
    }
    const finalSide = (winnerSide || m.reportedWinnerSide || "A") as "A" | "B" | "DRAW";
    const winnerIds = finalSide === "A" ? sideAIds : finalSide === "B" ? sideBIds : [];
    const winnerTeam = finalSide === "A" ? m.sideATeamId : finalSide === "B" ? m.sideBTeamId : null;
    await matches.updateOne(
      { _id: mid },
      {
        $set: {
          status: "approved",
          forumTag: "declared",
          reportedWinnerSide: finalSide,
          reportedWinnerLabel: sideLabel(finalSide),
          approvedWinnerUserId: winnerIds[0] || null,
          approvedWinnerTeamId: winnerTeam || null,
          reviewedBy: actorId,
          reviewedAt: now,
          reviewNote: note,
        },
      }
    );
    if (!m.seriesId) await applyScore(finalSide, 1);
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "match.approve", targetType: "Match", targetId: String(mid), details: { winnerSide: finalSide, winnerLabel: sideLabel(finalSide), note } });
    return NextResponse.json({ ok: true });
  }

  if (action === "reject" || action === "dispute") {
    await matches.updateOne(
      { _id: mid },
      {
        $set: {
          status: action === "reject" ? "rejected" : "disputed",
          forumTag: "issue",
          reviewedBy: actorId,
          reviewedAt: now,
          reviewNote: note,
        },
      }
    );
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: `match.${action}`, targetType: "Match", targetId: String(mid), details: { note } });
    return NextResponse.json({ ok: true });
  }

  if (action === "forfeit") {
    if (!winnerSide || winnerSide === "DRAW") return NextResponse.json({ error: "Select the winning player or team." }, { status: 400 });
    if (["approved", "forfeited", "cancelled"].includes(String(m.status))) return NextResponse.json({ error: "Match already finalized." }, { status: 400 });
    const winnerIds = winnerSide === "A" ? sideAIds : sideBIds;
    const winnerTeam = winnerSide === "A" ? m.sideATeamId : m.sideBTeamId;
    await matches.updateOne(
      { _id: mid },
      {
        $set: {
          status: "forfeited",
          forumTag: "declared",
          reportedWinnerSide: winnerSide,
          reportedWinnerLabel: sideLabel(winnerSide),
          reportedWinnerUserId: winnerIds[0] || null,
          reportedWinnerTeamId: winnerTeam || null,
          reviewedBy: actorId,
          reviewedAt: now,
          forfeitReason: note,
        },
      }
    );
    if (!m.seriesId) await applyScore(winnerSide, 1);
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "match.forfeit", targetType: "Match", targetId: String(mid), details: { winnerSide, winnerLabel: sideLabel(winnerSide), reason: note } });
    return NextResponse.json({ ok: true });
  }

  if (action === "override") {
    if (!winnerSide || winnerSide === "DRAW") return NextResponse.json({ error: "Select the winning player or team." }, { status: 400 });
    if (m.seriesId) return NextResponse.json({ error: "Series matches must be resolved via /match series-resolve in Discord." }, { status: 400 });
    const oldSide = m.reportedWinnerSide as "A" | "B" | "DRAW" | undefined;
    if (["approved", "forfeited"].includes(String(m.status)) && oldSide) await applyScore(oldSide, -1);
    await applyScore(winnerSide, 1);
    const winnerIds = winnerSide === "A" ? sideAIds : sideBIds;
    await matches.updateOne(
      { _id: mid },
      {
        $set: {
          status: "approved",
          forumTag: "declared",
          reportedWinnerSide: winnerSide,
          reportedWinnerLabel: sideLabel(winnerSide),
          approvedWinnerUserId: winnerIds[0] || null,
          approvedWinnerTeamId: (winnerSide === "A" ? m.sideATeamId : m.sideBTeamId) || null,
          overrideBy: actorId,
          overrideAt: now,
          overrideReason: note,
          reviewedBy: actorId,
          reviewedAt: now,
        },
      }
    );
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "match.override", targetType: "Match", targetId: String(mid), details: { from: oldSide || null, to: winnerSide, winnerLabel: sideLabel(winnerSide), reason: note } });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_status") {
    if (!status) return NextResponse.json({ error: "status required." }, { status: 400 });
    await matches.updateOne({ _id: mid }, { $set: { status, statusNote: note, statusChangedAt: now, statusChangedBy: actorId } });
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "match.status", targetType: "Match", targetId: String(mid), details: { status, note } });
    return NextResponse.json({ ok: true });
  }

  const updates: Record<string, unknown> = { editedBy: actorId, editedAt: now };
  if (mapName) updates.mapName = mapName;
  if (scheduledAt) {
    const dt = new Date(scheduledAt);
    if (Number.isNaN(dt.getTime())) return NextResponse.json({ error: "Invalid schedule date." }, { status: 400 });
    updates.scheduledAt = dt;
    const deadlineHrs = Number(((t.schedule || {}) as Record<string, unknown>).matchDeadlineHours ?? 48);
    updates.deadlineAt = new Date(dt.getTime() + deadlineHrs * 3600_000);
  }
  await matches.updateOne({ _id: mid }, { $set: updates });
  await writeAuditLog({ guildId: String(t.guildId), actorId, action: "match.edit", targetType: "Match", targetId: String(mid), details: { mapName, scheduledAt } });
  return NextResponse.json({ ok: true });
}

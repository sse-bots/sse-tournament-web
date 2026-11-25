import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getCollections, toObjectId, writeAuditLog } from "@/lib/mongodb";
import { canManageGuildOrTournament } from "@/lib/tournament-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const matchActionSchema = z.object({
  matchId: z.string().min(1),
  action: z.enum(["approve", "reject", "dispute", "forfeit", "override", "set_status", "edit"]),
  winnerSide: z.enum(["A", "B", "DRAW"]).optional(),
  status: z.enum(["scheduled", "ready", "in_progress", "pending_proof", "postponed"]).optional(),
  mapName: z.string().trim().max(80).optional(),
  scheduledAt: z.string().trim().optional(),
  note: z.string().trim().max(240).optional().default(""),
});

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
  if (!(await canManageGuildOrTournament(session, String(t.guildId), String(t.ownerId || "")))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const mid = toObjectId(parsed.data.matchId);
  if (!mid) return NextResponse.json({ error: "Invalid match ID." }, { status: 400 });
  const m = await matches.findOne({ _id: mid, tournamentId: tid });
  if (!m) return NextResponse.json({ error: "Match not found." }, { status: 404 });

  const actorId = session.user.discordId || session.user.sub;
  const now = new Date();
  const sideAIds = Array.isArray(m.sideAUserIds) ? m.sideAUserIds.map(String) : [];
  const sideBIds = Array.isArray(m.sideBUserIds) ? m.sideBUserIds.map(String) : [];

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
    await matches.updateOne({ _id: mid }, { $set: { status: "approved", reportedWinnerSide: finalSide, approvedWinnerUserId: winnerIds[0] || null, approvedWinnerTeamId: winnerTeam || null, reviewedBy: actorId, reviewedAt: now, reviewNote: note } });
    if (!m.seriesId) await applyScore(finalSide, 1);
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "match.approve", targetType: "Match", targetId: String(mid), details: { winnerSide: finalSide, note } });
    return NextResponse.json({ ok: true });
  }

  if (action === "reject" || action === "dispute") {
    await matches.updateOne({ _id: mid }, { $set: { status: action === "reject" ? "rejected" : "disputed", reviewedBy: actorId, reviewedAt: now, reviewNote: note } });
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: `match.${action}`, targetType: "Match", targetId: String(mid), details: { note } });
    return NextResponse.json({ ok: true });
  }

  if (action === "forfeit") {
    if (!winnerSide || winnerSide === "DRAW") return NextResponse.json({ error: "Select Side A or B." }, { status: 400 });
    if (["approved", "forfeited", "cancelled"].includes(String(m.status))) return NextResponse.json({ error: "Match already finalized." }, { status: 400 });
    const winnerIds = winnerSide === "A" ? sideAIds : sideBIds;
    const winnerTeam = winnerSide === "A" ? m.sideATeamId : m.sideBTeamId;
    await matches.updateOne({ _id: mid }, { $set: { status: "forfeited", reportedWinnerSide: winnerSide, reportedWinnerUserId: winnerIds[0] || null, reportedWinnerTeamId: winnerTeam || null, reviewedBy: actorId, reviewedAt: now, forfeitReason: note } });
    if (!m.seriesId) await applyScore(winnerSide, 1);
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "match.forfeit", targetType: "Match", targetId: String(mid), details: { winnerSide, reason: note } });
    return NextResponse.json({ ok: true });
  }

  if (action === "override") {
    if (!winnerSide || winnerSide === "DRAW") return NextResponse.json({ error: "Select Side A or B." }, { status: 400 });
    if (m.seriesId) return NextResponse.json({ error: "Series matches must be resolved via /match series-resolve in Discord." }, { status: 400 });
    const oldSide = m.reportedWinnerSide as "A" | "B" | "DRAW" | undefined;
    if (["approved", "forfeited"].includes(String(m.status)) && oldSide) await applyScore(oldSide, -1);
    await applyScore(winnerSide, 1);
    const winnerIds = winnerSide === "A" ? sideAIds : sideBIds;
    await matches.updateOne({ _id: mid }, { $set: { status: "approved", reportedWinnerSide: winnerSide, approvedWinnerUserId: winnerIds[0] || null, approvedWinnerTeamId: (winnerSide === "A" ? m.sideATeamId : m.sideBTeamId) || null, overrideBy: actorId, overrideAt: now, overrideReason: note, reviewedBy: actorId, reviewedAt: now } });
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "match.override", targetType: "Match", targetId: String(mid), details: { from: oldSide || null, to: winnerSide, reason: note } });
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

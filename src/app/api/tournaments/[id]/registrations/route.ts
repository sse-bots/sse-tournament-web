import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getCollections, toObjectId, writeAuditLog } from "@/lib/mongodb";
import { canManageGuildOrTournament, findBracketForPower } from "@/lib/tournament-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const regActionSchema = z.object({
  registrationId: z.string().min(1),
  action: z.enum(["approve_power", "reject_power", "adjust_power", "move_bracket", "disqualify", "remove"]),
  verifiedAverage: z.number().min(0).optional(),
  bracketId: z.string().optional(),
  reason: z.string().trim().max(240).optional().default(""),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await context.params;
  const tid = toObjectId(id);
  if (!tid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = regActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  const { tournaments, registrations, teams } = await getCollections();
  const t = await tournaments.findOne({ _id: tid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  if (!(await canManageGuildOrTournament(session, String(t.guildId), String(t.ownerId || "")))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const regOid = toObjectId(parsed.data.registrationId);
  if (!regOid) return NextResponse.json({ error: "Invalid registration ID." }, { status: 400 });
  const reg = await registrations.findOne({ _id: regOid, tournamentId: tid });
  if (!reg) return NextResponse.json({ error: "Registration not found." }, { status: 404 });

  const actorId = session.user.discordId || session.user.sub;
  const now = new Date();
  const { action, verifiedAverage, bracketId, reason } = parsed.data;

  if (action === "approve_power") {
    const avg = Number(reg.claimedSquadPower ?? 0);
    const bracket = findBracketForPower(t, avg);
    if (t.bracketsEnabled && !bracket) {
      return NextResponse.json({ error: `Average power ${avg} does not fit any configured bracket.` }, { status: 400 });
    }
    await registrations.updateOne({ _id: regOid }, { $set: { verifiedSquadPower: avg, squadPowerStatus: "approved", verifiedPowerValues: reg.powerValues || [], verifiedBy: actorId, verificationTimestamp: now, bracketId: bracket ? bracket._id : null, updatedAt: now } });
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "squadpower.approve", targetType: "Registration", targetId: String(regOid), details: { power: avg } });
    return NextResponse.json({ ok: true });
  }

  if (action === "reject_power") {
    await registrations.updateOne({ _id: regOid }, { $set: { squadPowerStatus: "rejected", verifiedSquadPower: null, verificationTimestamp: null, updatedAt: now } });
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "squadpower.reject", targetType: "Registration", targetId: String(regOid), details: { note: reason } });
    return NextResponse.json({ ok: true });
  }

  if (action === "adjust_power") {
    if (verifiedAverage === undefined) return NextResponse.json({ error: "verifiedAverage is required." }, { status: 400 });
    const bracket = findBracketForPower(t, verifiedAverage);
    if (t.bracketsEnabled && !bracket) return NextResponse.json({ error: "Adjusted power does not fit any bracket." }, { status: 400 });
    await registrations.updateOne({ _id: regOid }, { $set: { verifiedSquadPower: verifiedAverage, squadPowerStatus: "approved", verifiedBy: actorId, verificationTimestamp: now, powerManualOverride: true, powerOverrideReason: reason, powerOverrideAt: now, bracketId: bracket ? bracket._id : null, bracketOverride: false, updatedAt: now } });
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "squadpower.adjust", targetType: "Registration", targetId: String(regOid), details: { newPower: verifiedAverage, reason } });
    return NextResponse.json({ ok: true });
  }

  if (action === "move_bracket") {
    const brackets = Array.isArray(t.brackets) ? t.brackets : [];
    const targetB = brackets.find((b: { _id: unknown }) => String(b._id) === String(bracketId));
    if (!targetB) return NextResponse.json({ error: "Bracket not found." }, { status: 404 });
    await registrations.updateOne({ _id: regOid }, { $set: { bracketId: targetB._id, bracketOverride: true, bracketOverrideBy: actorId, bracketOverrideReason: reason, bracketOverrideAt: now, updatedAt: now } });
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "bracket.move_player", targetType: "Registration", targetId: String(regOid), details: { to: String(targetB._id), reason } });
    return NextResponse.json({ ok: true });
  }

  if (action === "disqualify") {
    await registrations.updateOne({ _id: regOid }, { $set: { status: "disqualified", disqualifiedAt: now, disqualifiedBy: actorId, disqualificationReason: reason, updatedAt: now } });
    await teams.updateMany({ tournamentId: tid, memberIds: String(reg.userId), status: "active" }, { $set: { status: "disqualified", disqualificationReason: `Member disqualified: ${reason}`, disqualifiedAt: now } });
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "registration.disqualify_player", targetType: "Registration", targetId: String(regOid), details: { playerId: String(reg.userId), reason } });
    return NextResponse.json({ ok: true });
  }

  if (t.settingsLocked) return NextResponse.json({ error: "Cannot remove player after start; disqualify instead." }, { status: 400 });
  await registrations.updateOne({ _id: regOid }, { $set: { status: "removed", removedAt: now, removedBy: actorId, removalReason: reason, updatedAt: now }, $unset: { teamId: "", teamIds: "" } });
  await writeAuditLog({ guildId: String(t.guildId), actorId, action: "registration.remove_player", targetType: "Registration", targetId: String(regOid), details: { playerId: String(reg.userId), reason } });
  return NextResponse.json({ ok: true });
}

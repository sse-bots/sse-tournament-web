import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getCollections, toObjectId, writeAuditLog } from "@/lib/mongodb";
import { resolveTournamentAccess } from "@/lib/rbac";
import { findBracketForPower } from "@/lib/tournament-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const manualRegSchema = z.object({
  userId: z.string().trim().regex(/^\d{15,22}$/, "Enter a valid numeric Discord User ID (15–22 digits)."),
  inGameId: z.string().trim().min(1, "Enter an in-game name or ID.").max(64),
  discordDisplayName: z.string().trim().max(64).optional().default(""),
  squadPower: z.number().min(0).max(1000000000),
  autoApprove: z.boolean().optional().default(true),
});

const regActionSchema = z.object({
  registrationId: z.string().optional().default(""),
  action: z.enum([
    "approve_power",
    "bulk_approve_power",
    "reject_power",
    "adjust_power",
    "move_bracket",
    "disqualify",
    "remove",
  ]),
  verifiedAverage: z.number().min(0).optional(),
  bracketId: z.string().optional(),
  reason: z.string().trim().max(240).optional().default(""),
});

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await context.params;
  const tid = toObjectId(id);
  if (!tid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = manualRegSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid player details." },
      { status: 400 }
    );
  }

  const { tournaments, registrations } = await getCollections();
  const t = await tournaments.findOne({ _id: tid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const { access } = await resolveTournamentAccess(session, t);
  if (!access.canManageTournament) {
    return NextResponse.json({ error: "Moderator or Owner permission required." }, { status: 403 });
  }
  if (["completed", "cancelled", "archived"].includes(String(t.status))) {
    return NextResponse.json({ error: "Cannot add players to a closed tournament." }, { status: 400 });
  }

  const d = parsed.data;
  const bracket = findBracketForPower(t, d.squadPower);
  if (t.bracketsEnabled && !bracket) {
    return NextResponse.json(
      { error: `Squad power ${d.squadPower} does not match any configured SP bracket.` },
      { status: 400 }
    );
  }

  const actorId = session.user.discordId || session.user.sub;
  const now = new Date();
  const existing = await registrations.findOne({ tournamentId: tid, userId: d.userId });
  const payload: Record<string, unknown> = {
    guildId: String(t.guildId),
    tournamentId: tid,
    userId: d.userId,
    discordDisplayName: d.discordDisplayName || d.inGameId,
    gameId: t.gameId,
    inGameId: d.inGameId,
    powerValues: [d.squadPower],
    claimedSquadPower: d.squadPower,
    verifiedSquadPower: d.autoApprove ? d.squadPower : null,
    squadPowerStatus: d.autoApprove ? "approved" : "pending",
    verifiedBy: d.autoApprove ? actorId : null,
    verificationTimestamp: d.autoApprove ? now : null,
    bracketId: bracket ? bracket._id : null,
    status: "registered",
    updatedAt: now,
  };

  let regId: string;
  if (existing) {
    await registrations.updateOne({ _id: existing._id }, { $set: payload });
    regId = String(existing._id);
  } else {
    const res = await registrations.insertOne({
      ...payload,
      wins: 0,
      losses: 0,
      points: 0,
      teamId: null,
      teamIds: [],
      createdAt: now,
    });
    regId = String(res.insertedId);
  }

  await writeAuditLog({
    guildId: String(t.guildId),
    actorId,
    action: "registration.manual_add",
    targetType: "Registration",
    targetId: regId,
    details: { userId: d.userId, inGameId: d.inGameId, squadPower: d.squadPower, autoApprove: d.autoApprove },
  });

  return NextResponse.json(
    { ok: true, id: regId, message: `Added ${d.inGameId} (${d.squadPower} SP)${bracket ? ` to ${bracket.name}` : ""}.` },
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
  const parsed = regActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  const { tournaments, registrations, teams } = await getCollections();
  const t = await tournaments.findOne({ _id: tid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const { access } = await resolveTournamentAccess(session, t);
  if (!access.canManageTournament) {
    return NextResponse.json(
      {
        error: access.isFairPlayLocked
          ? "Fair-Play Guard: registered participants cannot review squad power in this tournament."
          : "Moderator or Owner permission required.",
      },
      { status: 403 }
    );
  }

  const actorId = session.user.discordId || session.user.sub;
  const now = new Date();
  const { action, verifiedAverage, bracketId, reason } = parsed.data;

  if (action === "bulk_approve_power") {
    const pendingList = await registrations
      .find({ tournamentId: tid, status: "registered", squadPowerStatus: "pending" })
      .toArray();
    let approved = 0;
    let skipped = 0;
    for (const item of pendingList) {
      if (session.user.discordId && String(item.userId) === String(session.user.discordId)) {
        skipped += 1;
        continue;
      }
      const avg = Number(item.claimedSquadPower ?? 0);
      const bracket = findBracketForPower(t, avg);
      if (t.bracketsEnabled && !bracket) {
        skipped += 1;
        continue;
      }
      await registrations.updateOne(
        { _id: item._id },
        {
          $set: {
            verifiedSquadPower: avg,
            squadPowerStatus: "approved",
            verifiedPowerValues: item.powerValues || [],
            verifiedBy: actorId,
            verificationTimestamp: now,
            bracketId: bracket ? bracket._id : null,
            updatedAt: now,
          },
        }
      );
      approved += 1;
    }
    if (approved > 0) {
      await writeAuditLog({
        guildId: String(t.guildId),
        actorId,
        action: "squadpower.bulk_approve",
        targetType: "Tournament",
        targetId: String(tid),
        details: { approved, skipped },
      });
    }
    return NextResponse.json({
      ok: true,
      approved,
      skipped,
      message:
        approved > 0
          ? `Approved ${approved} pending Squad Power submission(s)${skipped > 0 ? ` (${skipped} skipped — check bracket range or self-submission)` : ""}.`
          : "No pending submissions could be bulk-approved.",
    });
  }

  const regOid = toObjectId(parsed.data.registrationId);
  if (!regOid) return NextResponse.json({ error: "Invalid registration ID." }, { status: 400 });
  const reg = await registrations.findOne({ _id: regOid, tournamentId: tid });
  if (!reg) return NextResponse.json({ error: "Registration not found." }, { status: 404 });

  if (session.user.discordId && String(reg.userId) === String(session.user.discordId)) {
    return NextResponse.json({ error: "You cannot review your own submission." }, { status: 403 });
  }

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

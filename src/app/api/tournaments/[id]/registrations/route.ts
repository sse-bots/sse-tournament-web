import { NextRequest, NextResponse } from "next/server";
import { Document, ObjectId } from "mongodb";
import { getCollections, toObjectId, serializeDocs, serializeDoc, writeAudit } from "@/lib/mongo";
import { getSessionActor, canManageTournament } from "@/lib/permissions";
import { parsePowerAverage, bracketForPower } from "@/lib/tournament-engine";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });
  const { registrations } = await getCollections();
  const rows = await registrations.find({ tournamentId: oid }).sort({ createdAt: -1 }).toArray();
  return NextResponse.json({ registrations: serializeDocs(rows) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });

  const { tournaments, registrations, teams } = await getCollections();
  const t = await tournaments.findOne({ _id: oid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const actor = await getSessionActor(String(t.guildId));
  if (!actor) return NextResponse.json({ error: "Sign in with SSE Nexus first." }, { status: 401 });

  const body = await req.json();
  const action = String(body.action || "register");

  if (action === "unregister") {
    if (!["registration", "registration_closed"].includes(String(t.status))) {
      return NextResponse.json({ error: "Withdrawal is closed after matchmaking starts." }, { status: 409 });
    }
    const curr = await registrations.findOne({ tournamentId: oid, userId: actor.discordId, status: "registered" });
    if (!curr) return NextResponse.json({ error: "You are not registered." }, { status: 404 });
    if (t.teamsLocked && t.mode === "team" && ((curr.teamIds && curr.teamIds.length > 0) || curr.teamId)) {
      return NextResponse.json({ error: "Team membership is locked. Ask a manager to substitute or remove you." }, { status: 409 });
    }
    await registrations.updateOne(
      { _id: curr._id },
      { $set: { status: "withdrawn", withdrawnAt: new Date(), updatedAt: new Date() }, $unset: { teamId: "", teamIds: "" } }
    );
    const userTeams = await teams.find({ tournamentId: oid, memberIds: actor.discordId }).toArray();
    for (const tm of userTeams) {
      const remaining = (tm.memberIds || []).filter((uid: string) => uid !== actor.discordId);
      const changes: Record<string, unknown> = { memberIds: remaining };
      if (String(tm.captainId) === actor.discordId) {
        if (remaining.length) changes.captainId = remaining[0];
        else changes.status = "disbanded";
      }
      await teams.updateOne({ _id: tm._id }, { $set: changes });
    }
    await writeAudit(String(t.guildId), actor.discordId, "unregister", "Registration", curr._id, {
      tournamentId: oid.toHexString(),
    });
    return NextResponse.json({ ok: true });
  }

  if (t.status !== "registration") {
    return NextResponse.json({ error: "Registration is not currently open." }, { status: 409 });
  }
  const squadPowerValues = String(body.squadPowerValues || "").trim();
  const proofUrl = String(body.proofUrl || "").trim();
  const inGameId = String(body.inGameId || "").trim();

  if (
    !proofUrl ||
    (!proofUrl.startsWith("https://") && !proofUrl.startsWith("http://") && !proofUrl.startsWith("data:image/"))
  ) {
    return NextResponse.json({ error: "Provide a valid screenshot proof URL or upload an image." }, { status: 400 });
  }

  let values: number[];
  let average: number;
  try {
    const parsed = parsePowerAverage(squadPowerValues);
    values = parsed.values;
    average = parsed.average;
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const bracket = bracketForPower(t, average);
  if (t.bracketsEnabled && !bracket) {
    return NextResponse.json(
      { error: `Average squad power ${average.toFixed(1)} does not fit any configured bracket.` },
      { status: 400 }
    );
  }

  const old = await registrations.findOne({ tournamentId: oid, userId: actor.discordId });
  const now = new Date();
  const data = {
    guildId: String(t.guildId),
    tournamentId: oid,
    userId: actor.discordId,
    displayName: actor.name,
    gameId: t.gameId,
    inGameId,
    powerValues: values,
    claimedSquadPower: average,
    verifiedSquadPower: null,
    squadPowerProofUrl: proofUrl,
    squadPowerStatus: "pending",
    bracketId: bracket ? (bracket._id as ObjectId) : null,
    teamId: old?.teamId || null,
    teamIds: Array.isArray(old?.teamIds) ? old.teamIds : [],
    status: "registered",
    wins: old?.wins || 0,
    losses: old?.losses || 0,
    points: old?.points || 0,
    removedManagerRoleIds: [],
    managerPrivilegesSuspended: true,
    updatedAt: now,
  };

  let regId: ObjectId;
  if (old) {
    await registrations.updateOne({ _id: old._id }, { $set: data });
    regId = old._id as ObjectId;
  } else {
    const res = await registrations.insertOne({ ...data, createdAt: now });
    regId = res.insertedId;
  }

  await writeAudit(String(t.guildId), actor.discordId, "register", "Registration", regId, {
    averagePower: average,
    powerValues: values,
    proof: proofUrl.slice(0, 120),
    managerPrivilegesSuspended: true,
  });

  return NextResponse.json({ registration: serializeDoc({ ...data, _id: regId }) }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });

  const { tournaments, registrations, teams } = await getCollections();
  const t = await tournaments.findOne({ _id: oid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const actor = await getSessionActor(String(t.guildId));
  const check = await canManageTournament(actor, t);
  if (!check.allowed) return NextResponse.json({ error: check.reason }, { status: 403 });

  const body = await req.json();
  const action = String(body.action || "");
  const userId = String(body.userId || "").trim();
  const note = String(body.note || body.reason || "").trim();

  const reg = await registrations.findOne({ tournamentId: oid, userId, status: "registered" });
  if (!reg) return NextResponse.json({ error: "Registered participant not found." }, { status: 404 });

  if (action === "approve_power" || action === "reject_power") {
    if (userId === actor!.discordId) {
      return NextResponse.json({ error: "You cannot review your own submission." }, { status: 403 });
    }
    if (action === "reject_power") {
      await registrations.updateOne(
        { _id: reg._id },
        { $set: { squadPowerStatus: "rejected", verifiedSquadPower: null, verificationTimestamp: null, reviewNote: note } }
      );
      await writeAudit(String(t.guildId), actor!.discordId, "squadpower.reject", "Registration", reg._id, { note });
      return NextResponse.json({ ok: true });
    }
    const avg = Number(reg.claimedSquadPower);
    const b = bracketForPower(t, avg);
    if (t.bracketsEnabled && !b) {
      return NextResponse.json({ error: "Claimed power does not fit any configured bracket." }, { status: 400 });
    }
    await registrations.updateOne(
      { _id: reg._id },
      {
        $set: {
          verifiedSquadPower: avg,
          squadPowerStatus: "approved",
          verifiedPowerValues: reg.powerValues || [],
          verifiedBy: actor!.discordId,
          verificationTimestamp: new Date(),
          bracketId: b ? b._id : null,
          reviewNote: note,
        },
      }
    );
    await writeAudit(String(t.guildId), actor!.discordId, "squadpower.approve", "Registration", reg._id, {
      power: avg,
      bracket: b?.name || null,
      note,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "adjust_power") {
    if (t.settingsLocked) {
      return NextResponse.json({ error: "Verified power is locked after start; use bracket override instead." }, { status: 409 });
    }
    const verifiedAverage = Number(body.verifiedAverage);
    if (Number.isNaN(verifiedAverage) || verifiedAverage < 0 || !note) {
      return NextResponse.json({ error: "Provide a valid verifiedAverage and an audit reason." }, { status: 400 });
    }
    const b = bracketForPower(t, verifiedAverage);
    if (t.bracketsEnabled && !b) {
      return NextResponse.json({ error: "Corrected power does not fit any bracket." }, { status: 400 });
    }
    await registrations.updateOne(
      { _id: reg._id },
      {
        $set: {
          verifiedSquadPower: verifiedAverage,
          squadPowerStatus: "approved",
          verifiedBy: actor!.discordId,
          verificationTimestamp: new Date(),
          powerManualOverride: true,
          powerOverrideReason: note,
          powerOverrideAt: new Date(),
          bracketId: b ? b._id : null,
          bracketOverride: false,
        },
      }
    );
    await writeAudit(String(t.guildId), actor!.discordId, "squadpower.adjust", "Registration", reg._id, {
      oldPower: reg.verifiedSquadPower,
      newPower: verifiedAverage,
      reason: note,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "remove_player") {
    if (t.settingsLocked) {
      return NextResponse.json({ error: "Matches already generated; disqualify player instead." }, { status: 409 });
    }
    if (!note) return NextResponse.json({ error: "Reason is required." }, { status: 400 });
    await registrations.updateOne(
      { _id: reg._id },
      {
        $set: { status: "removed", removedAt: new Date(), removedBy: actor!.discordId, removalReason: note },
        $unset: { teamId: "", teamIds: "" },
      }
    );
    const tms = await teams.find({ tournamentId: oid, memberIds: userId }).toArray();
    for (const tm of tms) {
      const rem = (tm.memberIds || []).filter((u: string) => u !== userId);
      const upd: Document = { memberIds: rem };
      if (String(tm.captainId) === userId) {
        if (rem.length) upd.captainId = rem[0];
        else upd.status = "disbanded";
      }
      await teams.updateOne({ _id: tm._id }, { $set: upd });
    }
    await writeAudit(String(t.guildId), actor!.discordId, "registration.remove_player", "Registration", reg._id, {
      playerId: userId,
      reason: note,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "disqualify_player") {
    if (!note) return NextResponse.json({ error: "Reason is required." }, { status: 400 });
    await registrations.updateOne(
      { _id: reg._id },
      { $set: { status: "disqualified", disqualifiedAt: new Date(), disqualifiedBy: actor!.discordId, disqualificationReason: note } }
    );
    await teams.updateMany(
      { tournamentId: oid, memberIds: userId, status: "active" },
      { $set: { status: "disqualified", disqualificationReason: `Member ${userId} disqualified: ${note}`, disqualifiedAt: new Date() } }
    );
    await writeAudit(String(t.guildId), actor!.discordId, "registration.disqualify_player", "Registration", reg._id, {
      playerId: userId,
      reason: note,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown registration action." }, { status: 400 });
}

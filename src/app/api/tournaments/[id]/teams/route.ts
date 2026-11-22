import { NextRequest, NextResponse } from "next/server";
import { Document, ObjectId } from "mongodb";
import { getCollections, toObjectId, serializeDocs, serializeDoc, writeAudit } from "@/lib/mongo";
import { getSessionActor, canManageTournament } from "@/lib/permissions";
import { enqueueBotEvent } from "@/lib/bot-sync";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });
  const { teams } = await getCollections();
  const rows = await teams.find({ tournamentId: oid }).sort({ name: 1 }).toArray();
  return NextResponse.json({ teams: serializeDocs(rows) });
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
  if (!actor) return NextResponse.json({ error: "Sign in with SSE Nexus first." }, { status: 401 });

  const body = await req.json();
  const action = String(body.action || "");
  const uid = actor.discordId;
  const isManager = (await canManageTournament(actor, t)).allowed;

  if (action === "create") {
    if (t.mode !== "team") {
      return NextResponse.json({ error: "This is an individual tournament." }, { status: 400 });
    }
    if (t.status !== "registration" || t.teamsLocked) {
      return NextResponse.json({ error: "Team registration is closed." }, { status: 409 });
    }
    const reg = await registrations.findOne({
      tournamentId: tournamentOid,
      userId: uid,
      status: "registered",
    });
    if (!reg) {
      return NextResponse.json(
        { error: "Register and submit squad-power proof first." },
        { status: 400 }
      );
    }
    if (!t.allowMultipleTeams) {
      const existingTeam = await teams.findOne({
        tournamentId: tournamentOid,
        memberIds: uid,
        status: { $nin: ["disqualified", "disbanded"] },
      });
      if (existingTeam) {
        return NextResponse.json(
          { error: "You already belong to a team in this tournament." },
          { status: 409 }
        );
      }
    }
    const name = String(body.name || "").trim();
    const logoUrl = String(body.logoUrl || "").trim();
    if (!name) return NextResponse.json({ error: "Team name is required." }, { status: 400 });
    if (logoUrl && !/^https:\/\//i.test(logoUrl)) {
      return NextResponse.json({ error: "Logo URL must start with https://" }, { status: 400 });
    }
    const dup = await teams.findOne({
      tournamentId: tournamentOid,
      nameLower: name.toLowerCase(),
      status: "active",
    });
    if (dup) {
      return NextResponse.json({ error: "A team with that name already exists." }, { status: 409 });
    }

    const doc: Record<string, unknown> = {
      guildId: String(t.guildId),
      tournamentId: tournamentOid,
      name,
      nameLower: name.toLowerCase(),
      captainId: uid,
      memberIds: [uid],
      invitedIds: [],
      status: "active",
      createdAt: new Date(),
    };
    if (logoUrl) doc.logoUrl = logoUrl;
    const res = await teams.insertOne(doc);
    const prevIds: ObjectId[] = Array.isArray(reg.teamIds) ? reg.teamIds : [];
    const nextIds = prevIds.some((x) => String(x) === res.insertedId.toHexString())
      ? prevIds
      : [...prevIds, res.insertedId];
    await registrations.updateOne(
      { _id: reg._id },
      { $set: { teamId: res.insertedId, teamIds: nextIds } }
    );
    await writeAudit(String(t.guildId), uid, "team.create", "Team", res.insertedId, { name });
    return NextResponse.json({ team: serializeDoc({ ...doc, _id: res.insertedId }) }, { status: 201 });
  }

  const teamId = toObjectId(body.teamId);
  const targetTeam = teamId
    ? await teams.findOne({ _id: teamId, tournamentId: tournamentOid })
    : body.teamName
      ? await teams.findOne({
          tournamentId: tournamentOid,
          nameLower: String(body.teamName).toLowerCase(),
          status: "active",
        })
      : null;

  if (!targetTeam) return NextResponse.json({ error: "Team not found." }, { status: 404 });

  const currMembers: string[] = Array.isArray(targetTeam.memberIds)
    ? targetTeam.memberIds.map(String)
    : [];
  const currInvited: string[] = Array.isArray(targetTeam.invitedIds)
    ? targetTeam.invitedIds.map(String)
    : [];

  async function syncRemovedMemberReg(memberUid: string, removedTeamId: ObjectId) {
    const reg = await registrations.findOne({ tournamentId: tournamentOid, userId: memberUid });
    if (!reg) return;
    const remainingIds = (Array.isArray(reg.teamIds) ? reg.teamIds : []).filter(
      (x: ObjectId) => String(x) !== removedTeamId.toHexString()
    );
    const activeOther = remainingIds.length
      ? await teams
          .find({ _id: { $in: remainingIds }, status: "active", memberIds: memberUid })
          .toArray()
      : [];
    await registrations.updateOne(
      { _id: reg._id },
      { $set: { teamIds: activeOther.map((x) => x._id), teamId: activeOther[0]?._id || null } }
    );
  }

  if (action === "join" || action === "accept") {
    if (t.mode !== "team" || t.status !== "registration" || t.teamsLocked) {
      return NextResponse.json({ error: "Team registration is locked." }, { status: 409 });
    }
    const reg = await registrations.findOne({
      tournamentId: tournamentOid,
      userId: uid,
      status: "registered",
    });
    if (!reg) return NextResponse.json({ error: "Register for this tournament first." }, { status: 400 });
    if (!t.allowMultipleTeams) {
      const existing = await teams.findOne({
        tournamentId: tournamentOid,
        memberIds: uid,
        status: { $nin: ["disqualified", "disbanded"] },
      });
      if (existing) return NextResponse.json({ error: "You already belong to a team." }, { status: 409 });
    }
    if (action === "accept" && !currInvited.includes(uid)) {
      return NextResponse.json({ error: "No invitation found for you on this team." }, { status: 403 });
    }
    if (action === "join" && t.teamInvitesOnly && !currInvited.includes(uid)) {
      return NextResponse.json(
        { error: "This tournament requires a captain invitation to join." },
        { status: 403 }
      );
    }
    if (currMembers.length >= Number(t.teamSizeMax || 5)) {
      return NextResponse.json({ error: "Team is full." }, { status: 409 });
    }
    const nextMembers = currMembers.includes(uid) ? currMembers : [...currMembers, uid];
    const nextInvited = currInvited.filter((x) => x !== uid);
    await teams.updateOne(
      { _id: targetTeam._id },
      { $set: { memberIds: nextMembers, invitedIds: nextInvited } }
    );
    const prevRegTeams: ObjectId[] = Array.isArray(reg.teamIds) ? reg.teamIds : [];
    const nextRegTeams = prevRegTeams.some((x) => String(x) === String(targetTeam._id))
      ? prevRegTeams
      : [...prevRegTeams, targetTeam._id as ObjectId];
    await registrations.updateOne(
      { _id: reg._id },
      { $set: { teamIds: nextRegTeams, teamId: reg.teamId || targetTeam._id } }
    );
    await writeAudit(
      String(t.guildId),
      uid,
      action === "accept" ? "team.accept_invite" : "team.join",
      "Team",
      targetTeam._id,
      { userId: uid }
    );
    return NextResponse.json({ ok: true });
  }

  if (action === "invite") {
    if (String(targetTeam.captainId) !== uid) {
      return NextResponse.json({ error: "Only the team captain can invite." }, { status: 403 });
    }
    if (t.teamsLocked || t.status !== "registration") {
      return NextResponse.json({ error: "Team changes are locked." }, { status: 409 });
    }
    const targetUserId = String(body.targetUserId || "").trim();
    if (!targetUserId) {
      return NextResponse.json({ error: "Target player Discord ID required." }, { status: 400 });
    }
    const targetReg = await registrations.findOne({
      tournamentId: tournamentOid,
      userId: targetUserId,
      status: "registered",
    });
    if (!targetReg) {
      return NextResponse.json(
        { error: "Target player must register for the tournament first." },
        { status: 400 }
      );
    }
    if (currMembers.length >= Number(t.teamSizeMax || 5)) {
      return NextResponse.json({ error: "Team is already full." }, { status: 409 });
    }
    const nextInvited = currInvited.includes(targetUserId)
      ? currInvited
      : [...currInvited, targetUserId];
    await teams.updateOne({ _id: targetTeam._id }, { $set: { invitedIds: nextInvited } });
    return NextResponse.json({ ok: true });
  }

  if (action === "leave") {
    if (t.teamsLocked) return NextResponse.json({ error: "Team membership is locked." }, { status: 409 });
    if (!currMembers.includes(uid)) {
      return NextResponse.json({ error: "You are not on this team." }, { status: 400 });
    }
    if (String(targetTeam.captainId) === uid && currMembers.length > 1) {
      return NextResponse.json(
        { error: "Captain must transfer captaincy before leaving." },
        { status: 409 }
      );
    }
    const nextMembers = currMembers.filter((x) => x !== uid);
    const updates: Document = { memberIds: nextMembers };
    if (nextMembers.length === 0) updates.status = "disbanded";
    await teams.updateOne({ _id: targetTeam._id }, { $set: updates });
    await syncRemovedMemberReg(uid, targetTeam._id as ObjectId);
    await writeAudit(String(t.guildId), uid, "team.leave", "Team", targetTeam._id);
    return NextResponse.json({ ok: true });
  }

  if (action === "edit") {
    if (String(targetTeam.captainId) !== uid && !isManager) {
      return NextResponse.json(
        { error: "Only the captain or a non-participating manager can edit this team." },
        { status: 403 }
      );
    }
    if (t.teamsLocked) return NextResponse.json({ error: "Team settings are locked." }, { status: 409 });
    const changes: Record<string, unknown> = {};
    if (body.name && String(body.name).trim()) {
      const n = String(body.name).trim();
      changes.name = n;
      changes.nameLower = n.toLowerCase();
    }
    if (body.logoUrl !== undefined) {
      const u = String(body.logoUrl).trim();
      if (u && !/^https:\/\//i.test(u)) {
        return NextResponse.json({ error: "Logo URL must use HTTPS." }, { status: 400 });
      }
      changes.logoUrl = u;
    }
    await teams.updateOne({ _id: targetTeam._id }, { $set: changes });
    await writeAudit(String(t.guildId), uid, "team.edit", "Team", targetTeam._id, changes);
    return NextResponse.json({ ok: true });
  }

  if (action === "transfer_captain") {
    if (String(targetTeam.captainId) !== uid && !isManager) {
      return NextResponse.json({ error: "Captain or manager required." }, { status: 403 });
    }
    const newCaptainId = String(body.newCaptainId || "").trim();
    if (!currMembers.includes(newCaptainId)) {
      return NextResponse.json({ error: "New captain must be a member of the team." }, { status: 400 });
    }
    await teams.updateOne(
      { _id: targetTeam._id },
      { $set: { captainId: newCaptainId, captainChangedAt: new Date() } }
    );
    await writeAudit(String(t.guildId), uid, "team.transfer_captain", "Team", targetTeam._id, {
      newCaptain: newCaptainId,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "kick") {
    const targetUserId = String(body.targetUserId || "").trim();
    const reason = String(body.reason || "Removed").trim();
    if (String(targetTeam.captainId) !== uid && !isManager) {
      return NextResponse.json({ error: "Captain or manager required." }, { status: 403 });
    }
    if (t.teamsLocked && !isManager) {
      return NextResponse.json({ error: "Only a manager can kick after team lock." }, { status: 403 });
    }
    if (!currMembers.includes(targetUserId)) {
      return NextResponse.json({ error: "That player is not on the team." }, { status: 400 });
    }
    if (targetUserId === String(targetTeam.captainId)) {
      return NextResponse.json(
        { error: "Transfer captaincy before removing captain." },
        { status: 400 }
      );
    }
    if (t.teamsLocked) {
      if (currMembers.length - 1 < Number(t.teamSizeMin || 1) && !t.allowIncompleteTeams) {
        return NextResponse.json(
          { error: "Removing this member would make the team incomplete. Use Substitute or Disqualify." },
          { status: 409 }
        );
      }
      const activeMatch = await matches.findOne({
        tournamentId: tournamentOid,
        status: { $in: ["in_progress", "pending_review", "disputed"] },
        $or: [
          { sideATeamId: targetTeam._id, sideAUserIds: targetUserId },
          { sideBTeamId: targetTeam._id, sideBUserIds: targetUserId },
        ],
      });
      if (activeMatch) {
        return NextResponse.json(
          { error: "Resolve this player's in-progress/pending/disputed match before removal." },
          { status: 409 }
        );
      }
    }

    const nextMembers = currMembers.filter((x) => x !== targetUserId);
    await teams.updateOne({ _id: targetTeam._id }, { $set: { memberIds: nextMembers } });
    await syncRemovedMemberReg(targetUserId, targetTeam._id as ObjectId);

    const futureMatches = t.teamsLocked
      ? await matches
          .find({
            tournamentId: tournamentOid,
            status: { $in: ["scheduled", "ready", "postponed"] },
            $or: [
              { sideATeamId: targetTeam._id, sideAUserIds: targetUserId },
              { sideBTeamId: targetTeam._id, sideBUserIds: targetUserId },
            ],
          })
          .toArray()
      : [];

    for (const md of futureMatches) {
      const ch: Record<string, unknown> = { rosterChangeReason: reason, rosterChangedAt: new Date() };
      if ((md.sideAUserIds || []).includes(targetUserId)) {
        ch.sideAUserIds = md.sideAUserIds.filter((x: string) => x !== targetUserId);
      }
      if ((md.sideBUserIds || []).includes(targetUserId)) {
        ch.sideBUserIds = md.sideBUserIds.filter((x: string) => x !== targetUserId);
      }
      await matches.updateOne({ _id: md._id }, { $set: ch });
    }

    if (futureMatches.length > 0) {
      await enqueueBotEvent({
        guildId: String(t.guildId),
        type: "match.roster_updated",
        actorId: uid,
        tournamentId: tournamentOid,
        payload: {
          action: "kick",
          outgoingId: targetUserId,
          incomingId: null,
          reason,
          matchIds: futureMatches.map((fm) => fm._id.toHexString()),
        },
      });
    }

    await writeAudit(String(t.guildId), uid, "team.kick", "Team", targetTeam._id, {
      playerId: targetUserId,
      reason,
      futureMatchesUpdated: futureMatches.length,
    });
    return NextResponse.json({ ok: true, futureMatchesUpdated: futureMatches.length });
  }

  if (action === "substitute") {
    if (!isManager) {
      return NextResponse.json(
        { error: "A non-participating tournament manager must authorize substitutions." },
        { status: 403 }
      );
    }
    const outgoingId = String(body.outgoingId || "").trim();
    const incomingId = String(body.incomingId || "").trim();
    const reason = String(body.reason || "").trim();
    if (!outgoingId || !incomingId || !reason) {
      return NextResponse.json(
        { error: "outgoingId, incomingId, and reason are required." },
        { status: 400 }
      );
    }
    if (!currMembers.includes(outgoingId)) {
      return NextResponse.json({ error: "Outgoing player not on team." }, { status: 400 });
    }
    if (outgoingId === String(targetTeam.captainId)) {
      return NextResponse.json(
        { error: "Transfer captaincy before substituting captain." },
        { status: 400 }
      );
    }
    const incomingReg = await registrations.findOne({
      tournamentId: tournamentOid,
      userId: incomingId,
      status: "registered",
    });
    if (!incomingReg) {
      return NextResponse.json({ error: "Incoming player must be registered." }, { status: 400 });
    }

    const activeMatch = await matches.findOne({
      tournamentId: tournamentOid,
      status: { $in: ["in_progress", "pending_review", "disputed"] },
      $or: [
        { sideATeamId: targetTeam._id, sideAUserIds: outgoingId },
        { sideBTeamId: targetTeam._id, sideBUserIds: outgoingId },
      ],
    });
    if (activeMatch) {
      return NextResponse.json(
        { error: "Resolve this player's active/pending match before substituting." },
        { status: 409 }
      );
    }

    const nextMembers = currMembers.filter((x) => x !== outgoingId);
    if (!nextMembers.includes(incomingId)) nextMembers.push(incomingId);
    await teams.updateOne({ _id: targetTeam._id }, { $set: { memberIds: nextMembers } });
    await syncRemovedMemberReg(outgoingId, targetTeam._id as ObjectId);

    const prevIncTeams: ObjectId[] = Array.isArray(incomingReg.teamIds) ? incomingReg.teamIds : [];
    const nextIncTeams = prevIncTeams.some((x) => String(x) === String(targetTeam._id))
      ? prevIncTeams
      : [...prevIncTeams, targetTeam._id as ObjectId];
    await registrations.updateOne(
      { _id: incomingReg._id },
      { $set: { teamIds: nextIncTeams, teamId: incomingReg.teamId || targetTeam._id } }
    );

    const upcoming = await matches
      .find({
        tournamentId: tournamentOid,
        status: { $in: ["scheduled", "ready", "postponed"] },
        $or: [
          { sideATeamId: targetTeam._id, sideAUserIds: outgoingId },
          { sideBTeamId: targetTeam._id, sideBUserIds: outgoingId },
        ],
      })
      .toArray();
    for (const md of upcoming) {
      const ch: Record<string, unknown> = { substitutionReason: reason, substitutedAt: new Date() };
      if ((md.sideAUserIds || []).includes(outgoingId)) {
        ch.sideAUserIds = md.sideAUserIds.map((x: string) => (x === outgoingId ? incomingId : x));
      }
      if ((md.sideBUserIds || []).includes(outgoingId)) {
        ch.sideBUserIds = md.sideBUserIds.map((x: string) => (x === outgoingId ? incomingId : x));
      }
      await matches.updateOne({ _id: md._id }, { $set: ch });
    }

    if (upcoming.length > 0) {
      await enqueueBotEvent({
        guildId: String(t.guildId),
        type: "match.roster_updated",
        actorId: uid,
        tournamentId: tournamentOid,
        payload: {
          action: "substitute",
          outgoingId,
          incomingId,
          reason,
          matchIds: upcoming.map((u) => u._id.toHexString()),
        },
      });
    }

    await writeAudit(String(t.guildId), uid, "team.substitute", "Team", targetTeam._id, {
      outgoing: outgoingId,
      incoming: incomingId,
      reason,
      upcomingMatchesUpdated: upcoming.length,
    });
    return NextResponse.json({ ok: true, upcomingMatchesUpdated: upcoming.length });
  }

  if (action === "disqualify") {
    if (!isManager) return NextResponse.json({ error: "Manager permission required." }, { status: 403 });
    const reason = String(body.reason || "").trim();
    if (!reason) return NextResponse.json({ error: "Disqualification reason required." }, { status: 400 });
    await teams.updateOne(
      { _id: targetTeam._id },
      {
        $set: {
          status: "disqualified",
          disqualifiedAt: new Date(),
          disqualifiedBy: uid,
          disqualificationReason: reason,
        },
      }
    );
    await writeAudit(String(t.guildId), uid, "team.disqualify", "Team", targetTeam._id, { reason });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    if (String(targetTeam.captainId) !== uid && !isManager) {
      return NextResponse.json({ error: "Captain or manager required." }, { status: 403 });
    }
    if (t.teamsLocked) {
      return NextResponse.json({ error: "Teams are locked after registration closes." }, { status: 409 });
    }
    await teams.updateOne(
      { _id: targetTeam._id },
      { $set: { status: "disbanded", disbandedAt: new Date(), disbandedBy: uid } }
    );
    for (const memberUid of currMembers) {
      await syncRemovedMemberReg(memberUid, targetTeam._id as ObjectId);
    }
    await writeAudit(String(t.guildId), uid, "team.delete", "Team", targetTeam._id, {
      name: targetTeam.name,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown team action." }, { status: 400 });
}

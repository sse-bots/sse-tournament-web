import { NextRequest, NextResponse } from "next/server";
import { getCollections, toObjectId, serializeDoc, serializeDocs, writeAudit } from "@/lib/mongo";
import { getSessionActor, canManageTournament, canReviewTournamentResult } from "@/lib/permissions";
import { enqueueBotEvent } from "@/lib/bot-sync";
import { SCORING_SYSTEMS, TEAM_POWER_RULES } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });

  const { tournaments, games, registrations, teams, matches } = await getCollections();
  const t = await tournaments.findOne({ _id: oid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const [game, regDocs, teamDocs, matchDocs, actor] = await Promise.all([
    games.findOne({ _id: t.gameId }),
    registrations.find({ tournamentId: oid }).sort({ createdAt: -1 }).toArray(),
    teams.find({ tournamentId: oid }).sort({ name: 1 }).toArray(),
    matches.find({ tournamentId: oid }).sort({ roundNumber: 1, matchNumber: 1 }).toArray(),
    getSessionActor(String(t.guildId)),
  ]);

  const manageCheck = await canManageTournament(actor, t);
  const reviewCheck = await canReviewTournamentResult(actor, t);
  const teamNameMap = new Map(teamDocs.map((tm) => [String(tm._id), String(tm.name)]));

  const enrichedMatches = serializeDocs(matchDocs).map((m) => ({
    ...m,
    sideATeamName: m.sideATeamId ? teamNameMap.get(String(m.sideATeamId)) || null : null,
    sideBTeamName: m.sideBTeamId ? teamNameMap.get(String(m.sideBTeamId)) || null : null,
  }));

  return NextResponse.json({
    tournament: { ...serializeDoc(t), gameName: game?.name || "Unknown Game" },
    registrations: serializeDocs(regDocs),
    teams: serializeDocs(teamDocs),
    matches: enrichedMatches,
    permissions: {
      canManage: manageCheck.allowed,
      manageReason: manageCheck.reason || null,
      suspendedByParticipation: Boolean(manageCheck.suspendedByParticipation),
      canReview: reviewCheck.allowed,
      isBotAdmin: Boolean(actor?.isBotAdmin),
      discordId: actor?.discordId || null,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });

  const { tournaments, teams } = await getCollections();
  const t = await tournaments.findOne({ _id: oid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const actor = await getSessionActor(String(t.guildId));
  const check = await canManageTournament(actor, t);
  if (!check.allowed) return NextResponse.json({ error: check.reason }, { status: 403 });

  const body = await req.json();

  if (body.announcementChannelId !== undefined && Object.keys(body).length === 1) {
    await tournaments.updateOne(
      { _id: oid },
      { $set: { announcementChannelId: String(body.announcementChannelId || "").trim() || null, updatedAt: new Date() } }
    );
    await writeAudit(String(t.guildId), actor!.discordId, "tournament.announcement_channel", "Tournament", oid, {
      channelId: body.announcementChannelId,
    });
    return NextResponse.json({ ok: true });
  }

  if (t.settingsLocked || !["draft", "registration", "registration_closed"].includes(String(t.status))) {
    return NextResponse.json({ error: "Tournament configuration is locked after start." }, { status: 409 });
  }

  const changes: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (!n) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    changes.name = n;
    changes.nameLower = n.toLowerCase();
  }
  if (body.description !== undefined) changes.description = String(body.description);
  if (body.bracketsEnabled !== undefined) changes.bracketsEnabled = Boolean(body.bracketsEnabled);

  if (body.scoring !== undefined) {
    if (!SCORING_SYSTEMS.includes(body.scoring)) {
      return NextResponse.json({ error: "Invalid scoring system." }, { status: 400 });
    }
    changes.scoring = body.scoring;
  }

  if (body.seriesBestOf !== undefined) {
    const bo = Number(body.seriesBestOf);
    if (!Number.isInteger(bo) || bo < 1 || bo > 15 || bo % 2 === 0) {
      return NextResponse.json({ error: "Best-of series must be an odd integer (1, 3, 5, ..., 15)." }, { status: 400 });
    }
    changes.seriesBestOf = bo;
  }

  if (body.swissRounds !== undefined) changes.swissRounds = Math.max(0, Math.min(20, Number(body.swissRounds)));
  if (body.maps !== undefined) {
    const arr = Array.isArray(body.maps)
      ? body.maps.map((m: unknown) => String(m).trim()).filter(Boolean)
      : String(body.maps).split(",").map((m) => m.trim()).filter(Boolean);
    changes.maps = arr.slice(0, 25);
  }

  if (body.schedule !== undefined) {
    const s = body.schedule || {};
    const startAt = s.startAt ? new Date(s.startAt) : t.schedule?.startAt || null;
    const endAt = s.endAt ? new Date(s.endAt) : t.schedule?.endAt || null;
    if (startAt && endAt && endAt <= startAt) {
      return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
    }
    changes.schedule = {
      startAt: s.startAt === "" ? null : startAt,
      endAt: s.endAt === "" ? null : endAt,
      matchDeadlineHours: Math.max(1, Math.min(720, Number(s.matchDeadlineHours ?? t.schedule?.matchDeadlineHours ?? 48))),
      matchDurationMinutes: Math.max(15, Math.min(240, Number(s.matchDurationMinutes ?? t.schedule?.matchDurationMinutes ?? 60))),
    };
  }

  if (body.resultPolicy !== undefined) {
    changes.resultPolicy = {
      proofRequired: Boolean(body.resultPolicy.proofRequired ?? t.resultPolicy?.proofRequired ?? true),
      approvalRequired: Boolean(body.resultPolicy.approvalRequired ?? t.resultPolicy?.approvalRequired ?? true),
      allowDraws: Boolean(body.resultPolicy.allowDraws ?? t.resultPolicy?.allowDraws ?? false),
    };
  }

  if (body.tieBreakers !== undefined) {
    const tb = Array.isArray(body.tieBreakers)
      ? body.tieBreakers
      : String(body.tieBreakers).split(",").map((x) => x.trim()).filter(Boolean);
    changes.tieBreakers = tb.slice(0, 5);
  }

  if (body.winWeight !== undefined) changes.winWeight = Number(body.winWeight);
  if (body.powerWeight !== undefined) changes.powerWeight = Number(body.powerWeight);
  if (body.pointsWeight !== undefined) changes.pointsWeight = Number(body.pointsWeight);
  if (body.leaderboardUpdateHours !== undefined) changes.leaderboardUpdateHours = Number(body.leaderboardUpdateHours);

  if (t.mode === "team") {
    const minS = body.teamSizeMin !== undefined ? Number(body.teamSizeMin) : Number(t.teamSizeMin || 2);
    const maxS = body.teamSizeMax !== undefined ? Number(body.teamSizeMax) : Number(t.teamSizeMax || 5);
    if (minS < 1 || minS > maxS || maxS > 20) {
      return NextResponse.json({ error: "Minimum team size cannot exceed maximum (1..20)." }, { status: 400 });
    }
    changes.teamSizeMin = minS;
    changes.teamSizeMax = maxS;

    if (body.teamPowerRule !== undefined) {
      if (!TEAM_POWER_RULES.includes(body.teamPowerRule)) {
        return NextResponse.json({ error: "Invalid teamPowerRule." }, { status: 400 });
      }
      changes.teamPowerRule = body.teamPowerRule;
    }
    if (body.allowIncompleteTeams !== undefined) changes.allowIncompleteTeams = Boolean(body.allowIncompleteTeams);
    if (body.teamInvitesOnly !== undefined) changes.teamInvitesOnly = Boolean(body.teamInvitesOnly);
    if (body.allowMultipleTeams === false) {
      const activeTeams = await teams.find({ tournamentId: oid, status: "active" }).toArray();
      const counts = new Map<string, number>();
      for (const tm of activeTeams) {
        for (const uid of tm.memberIds || []) {
          counts.set(String(uid), (counts.get(String(uid)) || 0) + 1);
        }
      }
      if (Array.from(counts.values()).some((c) => c > 1)) {
        return NextResponse.json(
          { error: "Cannot disable multiple teams while players belong to multiple active teams." },
          { status: 409 }
        );
      }
      changes.allowMultipleTeams = false;
    } else if (body.allowMultipleTeams === true) {
      changes.allowMultipleTeams = true;
    }
  }

  const parseRoles = (raw: unknown) =>
    (Array.isArray(raw) ? raw : String(raw).split(",")).map((s: unknown) => String(s).trim()).filter(Boolean);

  if (body.managerRoleIds !== undefined) changes.managerRoleIds = parseRoles(body.managerRoleIds);
  if (body.reviewerRoleIds !== undefined) changes.reviewerRoleIds = parseRoles(body.reviewerRoleIds);
  if (body.headManagerRoleIds !== undefined) changes.headManagerRoleIds = parseRoles(body.headManagerRoleIds);
  if (body.awardRoleIds !== undefined) changes.awardRoleIds = body.awardRoleIds;
  if (body.prizeDescriptions !== undefined) changes.prizeDescriptions = body.prizeDescriptions;
  if (body.announcementChannelId !== undefined) {
    changes.announcementChannelId = String(body.announcementChannelId || "").trim() || null;
  }

  await tournaments.updateOne({ _id: oid }, { $set: changes });
  await writeAudit(String(t.guildId), actor!.discordId, "tournament.configure", "Tournament", oid, changes);
  const updated = await tournaments.findOne({ _id: oid });
  return NextResponse.json({ tournament: serializeDoc(updated) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });

  const { tournaments, registrations, teams, matches, tickets, seriesRecords } = await getCollections();
  const t = await tournaments.findOne({ _id: oid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const actor = await getSessionActor(String(t.guildId));
  const check = await canManageTournament(actor, t);
  if (!check.allowed) return NextResponse.json({ error: check.reason }, { status: 403 });

  const disputedCount = await matches.countDocuments({ tournamentId: oid, status: "disputed" });
  if (disputedCount > 0) {
    return NextResponse.json(
      { error: "Deletion blocked: this tournament has disputed matches. Resolve them or archive first." },
      { status: 409 }
    );
  }

  const [relatedMatches, relatedTickets] = await Promise.all([
    matches.find({ tournamentId: oid, channelId: { $exists: true, $ne: null } }).toArray(),
    tickets.find({ tournamentId: oid, channelId: { $exists: true, $ne: null } }).toArray(),
  ]);
  const channelIds = [...relatedMatches, ...relatedTickets]
    .map((doc) => (doc.channelId ? String(doc.channelId).trim() : ""))
    .filter(Boolean);

  await Promise.all([
    registrations.deleteMany({ tournamentId: oid }),
    teams.deleteMany({ tournamentId: oid }),
    matches.deleteMany({ tournamentId: oid }),
    tickets.deleteMany({ tournamentId: oid }),
    seriesRecords.deleteMany({ tournamentId: oid }),
    tournaments.deleteOne({ _id: oid }),
  ]);

  if (channelIds.length > 0) {
    await enqueueBotEvent({
      guildId: String(t.guildId),
      type: "match.cleanup_channels",
      actorId: actor!.discordId,
      tournamentId: oid,
      payload: {
        channelIds,
        deleteChannels: false,
        reason: `Tournament "${t.name}" deleted on Web Arena; channel archived.`,
      },
    });
  }

  await writeAudit(String(t.guildId), actor!.discordId, "tournament.delete", "Tournament", oid, {
    name: t.name,
    archivedChannels: channelIds.length,
  });
  return NextResponse.json({ ok: true });
}

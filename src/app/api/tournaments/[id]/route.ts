import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getCollections, toObjectId, writeAuditLog } from "@/lib/mongodb";
import { generateWeekMatches } from "@/lib/matchmaking-service";
import {
  extractGuildChannels,
  extractGuildRoles,
  resolveTournamentAccess,
} from "@/lib/rbac";
import {
  bracketsOverlap,
  getFullTournamentDetail,
} from "@/lib/tournament-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  action: z
    .enum([
      "update_settings",
      "update_moderators",
      "open_registration",
      "close_registration",
      "reopen_registration",
      "trigger_matchmaking",
      "close_week",
      "reopen_week",
      "close_tournament",
      "send_announcement",
      "start",
      "pause",
      "resume",
      "finish",
      "cancel",
      "archive",
      "add_bracket",
      "delete_bracket",
    ])
    .default("update_settings"),
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(1500).optional(),
  maps: z.array(z.string().trim().min(1)).max(25).optional(),
  scoring: z
    .enum(["wins", "power", "points", "combined", "win_percentage"])
    .optional(),
  proofRequired: z.boolean().optional(),
  approvalRequired: z.boolean().optional(),
  allowDraws: z.boolean().optional(),
  allowIncompleteTeams: z.boolean().optional(),
  teamInvitesOnly: z.boolean().optional(),
  swissRounds: z.number().int().min(0).max(20).optional(),
  seriesBestOf: z.number().int().min(1).max(15).optional(),
  matchDeadlineHours: z.number().int().min(1).max(720).optional(),
  matchDurationMinutes: z.number().int().min(15).max(240).optional(),
  prizes: z
    .object({
      first: z.string().trim().max(120).optional(),
      second: z.string().trim().max(120).optional(),
      third: z.string().trim().max(120).optional(),
    })
    .optional(),
  managerRoleIds: z.array(z.string().trim().min(1)).max(15).optional(),
  reviewerRoleIds: z.array(z.string().trim().min(1)).max(15).optional(),
  headManagerRoleIds: z.array(z.string().trim().min(1)).max(15).optional(),
  awardRoleIds: z
    .object({
      first: z.string().trim().optional(),
      second: z.string().trim().optional(),
      third: z.string().trim().optional(),
    })
    .optional(),
  announcementChannelId: z.string().trim().optional().nullable(),
  announcementMessage: z.string().trim().min(2).max(3800).optional(),
  weekNumber: z.number().int().min(1).max(52).optional(),
  broadcastToMatches: z.boolean().optional(),
  alsoPostServerChannel: z.boolean().optional(),
  declareResults: z.boolean().optional(),
  reason: z.string().trim().max(240).optional(),
  force: z.boolean().optional(),
  bracket: z
    .object({
      name: z.string().trim().min(1).max(60),
      minPower: z.number().min(0),
      maxPower: z.number().min(0).nullable().optional(),
      allowOverlap: z.boolean().optional(),
    })
    .optional(),
  bracketName: z.string().trim().optional(),
});

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });

  const { tournaments } = await getCollections();
  const doc = await tournaments.findOne({ _id: oid });
  if (!doc) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const session = await getSession();
  const { access, guildCfg } = await resolveTournamentAccess(session, doc);
  const showStaff = access.canManageTournament || access.canAssignModerators;

  const detail = await getFullTournamentDetail(
    doc,
    showStaff,
    session?.user.discordId || null
  );

  return NextResponse.json(
    {
      ...detail,
      access,
      canManage: access.canManageTournament,
      discordRoles: showStaff ? extractGuildRoles(guildCfg) : [],
      discordChannels: showStaff ? extractGuildChannels(guildCfg) : [],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await context.params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });

  const { tournaments, matches, guildConfig } = await getCollections();
  const t = await tournaments.findOne({ _id: oid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid update payload." },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const { access } = await resolveTournamentAccess(session, t);
  const actorId = session.user.discordId || session.user.sub;
  const now = new Date();

  // STRICT: Only Tournament Owner / Server Owner can assign/edit Moderator Roles!
  if (d.action === "update_moderators") {
    if (!access.canAssignModerators) {
      return NextResponse.json(
        { error: "Only the Server Owner or Tournament Owner can configure Moderator roles." },
        { status: 403 }
      );
    }
    const updates: Record<string, unknown> = { updatedAt: now };
    if (d.managerRoleIds !== undefined) {
      updates.managerRoleIds = Array.from(new Set(d.managerRoleIds));
    }
    if (d.reviewerRoleIds !== undefined) {
      updates.reviewerRoleIds = Array.from(new Set(d.reviewerRoleIds));
    }
    if (d.headManagerRoleIds !== undefined) {
      updates.headManagerRoleIds = Array.from(new Set(d.headManagerRoleIds));
    }
    if (d.awardRoleIds !== undefined) {
      updates.awardRoleIds = d.awardRoleIds;
    }
    if (d.announcementChannelId !== undefined) {
      updates.announcementChannelId = d.announcementChannelId || null;
    }
    await tournaments.updateOne({ _id: oid }, { $set: updates });
    await writeAuditLog({
      guildId: String(t.guildId),
      actorId,
      action: "tournament.moderators_updated",
      targetType: "Tournament",
      targetId: id,
      details: updates,
    });
    return NextResponse.json({ ok: true });
  }

  // All other management actions require Owner OR assigned Moderator (and NOT Fair-Play locked)
  if (!access.canManageTournament) {
    const msg = access.isFairPlayLocked
      ? "Fair-Play Guard: you are registered as a participant in this tournament, so management actions are disabled."
      : "Tournament Owner or assigned Moderator permission required.";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  if (d.action === "open_registration") {
    if (t.settingsLocked || !["draft", "registration_closed"].includes(String(t.status))) {
      return NextResponse.json({ error: "Registration can only open before start." }, { status: 400 });
    }
    await tournaments.updateOne({ _id: oid }, { $set: { status: "registration", registrationOpenedAt: now, teamsLocked: false, updatedAt: now } });
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "registration.open", targetType: "Tournament", targetId: id });
    return NextResponse.json({ ok: true });
  }

  if (d.action === "close_registration") {
    if (t.status !== "registration") return NextResponse.json({ error: "Registration is not open." }, { status: 400 });
    await tournaments.updateOne({ _id: oid }, { $set: { status: "registration_closed", registrationClosedAt: now, teamsLocked: true, updatedAt: now } });
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "registration.close", targetType: "Tournament", targetId: id });
    return NextResponse.json({ ok: true });
  }

  if (d.action === "reopen_registration") {
    if (t.status !== "registration_closed" || t.settingsLocked) {
      return NextResponse.json({ error: "Only a closed, unstarted tournament can reopen." }, { status: 400 });
    }
    if ((await matches.countDocuments({ tournamentId: oid })) > 0) {
      return NextResponse.json({ error: "Matches already exist." }, { status: 400 });
    }
    await tournaments.updateOne({ _id: oid }, { $set: { status: "registration", teamsLocked: false, registrationReopenedAt: now, updatedAt: now } });
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "registration.reopen", targetType: "Tournament", targetId: id });
    return NextResponse.json({ ok: true });
  }

  // Immediate Multi-Week Matchmaking Generation!
  if (d.action === "trigger_matchmaking") {
    const res = await generateWeekMatches(t, actorId, d.weekNumber);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json(res);
  }

  // Close Week (locks all match posts in that week's Discord Forum!)
  if (d.action === "close_week") {
    const wk = d.weekNumber || 1;
    const weeks = Array.isArray(t.weeks) ? (t.weeks as Array<Record<string, unknown>>) : [];
    const hasWeek = weeks.some((w) => Number(w.weekNumber) === wk);
    if (hasWeek) {
      await tournaments.updateOne(
        { _id: oid, "weeks.weekNumber": wk },
        { $set: { "weeks.$.status": "closed", "weeks.$.closedAt": now, updatedAt: now } }
      );
    } else {
      await tournaments.updateOne(
        { _id: oid },
        {
          $push: { weeks: { weekNumber: wk, status: "closed", closedAt: now, createdAt: now } } as never,
          $set: { updatedAt: now },
        }
      );
    }
    await writeAuditLog({
      guildId: String(t.guildId),
      actorId,
      action: "week.close",
      targetType: "Tournament",
      targetId: id,
      details: { weekNumber: wk, reason: d.reason || "" },
    });
    return NextResponse.json({
      ok: true,
      message: `Week ${wk} closed! Bot will lock all Week ${wk} match posts in Discord (~15s).`,
    });
  }

  // Reopen Week
  if (d.action === "reopen_week") {
    const wk = d.weekNumber || 1;
    await tournaments.updateOne(
      { _id: oid, "weeks.weekNumber": wk },
      { $set: { "weeks.$.status": "open", "weeks.$.reopenedAt": now, updatedAt: now } }
    );
    await writeAuditLog({
      guildId: String(t.guildId),
      actorId,
      action: "week.reopen",
      targetType: "Tournament",
      targetId: id,
      details: { weekNumber: wk },
    });
    return NextResponse.json({
      ok: true,
      message: `Week ${wk} reopened! Active match posts will be unlocked in Discord.`,
    });
  }

  // Close Tournament (optionally declares final standings OR simply closes & locks all weeks)
  if (d.action === "close_tournament") {
    if (["completed", "cancelled", "archived"].includes(String(t.status))) {
      return NextResponse.json({ error: "Tournament is already closed." }, { status: 400 });
    }
    const weeks = Array.isArray(t.weeks) ? (t.weeks as Array<Record<string, unknown>>) : [];
    const closedWeeks = weeks.map((w) => ({
      ...w,
      status: "closed",
      closedAt: w.closedAt || now,
    }));

    if (d.declareResults) {
      const pending = await matches.countDocuments({
        tournamentId: oid,
        status: { $in: ["scheduled", "ready", "in_progress", "pending_review", "rejected", "disputed", "postponed"] },
      });
      if (pending > 0 && !d.force) {
        return NextResponse.json(
          { error: `There are ${pending} unresolved match(es). Enable Force Close to declare standings anyway.` },
          { status: 400 }
        );
      }
      const detail = await getFullTournamentDetail(t, true);
      const finalStandings: Array<Record<string, unknown>> = [];
      const bracketGroups = detail.tournament.bracketsEnabled
        ? detail.tournament.brackets.map((b) => ({ name: b.name, id: b.id }))
        : [{ name: "Overall", id: null as string | null }];
      for (const bg of bracketGroups) {
        if (detail.tournament.mode === "individual") {
          detail.registrations
            .filter((r) => r.status === "registered" && (bg.id === null || r.bracketId === bg.id))
            .slice(0, 3)
            .forEach((row, idx) => {
              finalStandings.push({ bracket: bg.name, place: idx + 1, userId: row.userId, wins: row.wins, losses: row.losses, points: row.points, power: row.verifiedSquadPower });
            });
        } else {
          detail.teams
            .filter((tm) => tm.status === "active" && (bg.id === null || tm.bracketId === bg.id))
            .slice(0, 3)
            .forEach((row, idx) => {
              finalStandings.push({ bracket: bg.name, place: idx + 1, teamId: row.id, teamName: row.name, wins: row.wins, losses: row.losses, points: row.points });
            });
        }
      }
      await tournaments.updateOne(
        { _id: oid },
        {
          $set: {
            status: "completed",
            completedAt: now,
            standingsFrozen: true,
            finishedWithUnresolvedMatches: pending > 0,
            finalStandings,
            finalStandingsFrozenAt: now,
            finalAnnouncementSent: false,
            weeks: closedWeeks,
            updatedAt: now,
          },
        }
      );
      await writeAuditLog({
        guildId: String(t.guildId),
        actorId,
        action: "tournament.finish",
        targetType: "Tournament",
        targetId: id,
        details: { force: Boolean(d.force), pending, placements: finalStandings.length, reason: d.reason || "" },
      });
      return NextResponse.json({
        ok: true,
        message: "Tournament closed & winners declared! Bot will announce podiums and lock all week forums (~15s).",
      });
    }

    await tournaments.updateOne(
      { _id: oid },
      {
        $set: {
          status: "completed",
          completedAt: now,
          closedReason: d.reason || "",
          weeks: closedWeeks,
          updatedAt: now,
        },
      }
    );
    await writeAuditLog({
      guildId: String(t.guildId),
      actorId,
      action: "tournament.close",
      targetType: "Tournament",
      targetId: id,
      details: { reason: d.reason || "" },
    });
    return NextResponse.json({
      ok: true,
      message: "Tournament closed! Bot will lock all week forums & post closure notice in Discord (~15s).",
    });
  }

  // Send Announcement (Server channel, Locked Week Announcement post, and/or Broadcast to All Week Match Posts)
  if (d.action === "send_announcement") {
    if (!d.announcementMessage) {
      return NextResponse.json({ error: "Enter an announcement message." }, { status: 400 });
    }
    const gcfg = await guildConfig.findOne({ guildId: String(t.guildId) });
    const channelsObj = (gcfg?.channels || {}) as Record<string, string>;
    const resolvedChannel =
      d.announcementChannelId ||
      (typeof t.announcementChannelId === "string" ? t.announcementChannelId : null) ||
      (typeof gcfg?.announcementChannelId === "string" ? gcfg.announcementChannelId : null) ||
      channelsObj.announcements ||
      null;

    if (!d.weekNumber && !resolvedChannel) {
      return NextResponse.json(
        {
          error:
            "No Discord announcement channel is configured yet. Select a channel in the dropdown or configure one in Server Settings.",
        },
        { status: 400 }
      );
    }

    await writeAuditLog({
      guildId: String(t.guildId),
      actorId,
      action: "tournament.web_announce",
      targetType: "Tournament",
      targetId: id,
      details: {
        message: d.announcementMessage,
        channelId: resolvedChannel,
        weekNumber: d.weekNumber || null,
        broadcastToMatches: Boolean(d.broadcastToMatches),
        alsoPostServerChannel: Boolean(d.alsoPostServerChannel),
      },
    });
    return NextResponse.json({
      ok: true,
      message: d.weekNumber
        ? `Week ${d.weekNumber} announcement queued! Bot will post to the locked Week ${d.weekNumber} Announcement post${d.broadcastToMatches ? " and all match posts in that week" : ""} (~15s).`
        : "Announcement queued to Discord! Delivery status will update automatically within ~15 seconds.",
    });
  }

  if (d.action === "start") {
    if (!["registration_closed", "matchmaking"].includes(String(t.status))) {
      return NextResponse.json({ error: "Close registration before starting." }, { status: 400 });
    }
    if ((await matches.countDocuments({ tournamentId: oid })) === 0) {
      return NextResponse.json({ error: "Generate matchmaking or create matches first." }, { status: 400 });
    }
    await tournaments.updateOne({ _id: oid }, { $set: { status: "in_progress", settingsLocked: true, teamsLocked: true, startedAt: now, updatedAt: now } });
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "tournament.start", targetType: "Tournament", targetId: id });
    return NextResponse.json({ ok: true });
  }

  if (d.action === "pause") {
    if (t.status !== "in_progress") return NextResponse.json({ error: "Tournament is not in progress." }, { status: 400 });
    await tournaments.updateOne({ _id: oid }, { $set: { status: "paused", pausedAt: now, pauseReason: d.reason || "", updatedAt: now } });
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "tournament.pause", targetType: "Tournament", targetId: id, details: { reason: d.reason || "" } });
    return NextResponse.json({ ok: true });
  }

  if (d.action === "resume") {
    if (t.status !== "paused") return NextResponse.json({ error: "Tournament is not paused." }, { status: 400 });
    await tournaments.updateOne({ _id: oid }, { $set: { status: "in_progress", resumedAt: now, updatedAt: now } });
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "tournament.resume", targetType: "Tournament", targetId: id });
    return NextResponse.json({ ok: true });
  }

  if (d.action === "finish") {
    if (!["in_progress", "paused"].includes(String(t.status))) {
      return NextResponse.json({ error: "Only an in-progress or paused tournament can declare final results." }, { status: 400 });
    }
    const pending = await matches.countDocuments({
      tournamentId: oid,
      status: { $in: ["scheduled", "ready", "in_progress", "pending_review", "rejected", "disputed", "postponed"] },
    });
    if (pending > 0 && !d.force) {
      return NextResponse.json({ error: `There are ${pending} unresolved match(es). Resolve them or enable Force Declare.` }, { status: 400 });
    }
    const detail = await getFullTournamentDetail(t, true);
    const finalStandings: Array<Record<string, unknown>> = [];
    const bracketGroups = detail.tournament.bracketsEnabled
      ? detail.tournament.brackets.map((b) => ({ name: b.name, id: b.id }))
      : [{ name: "Overall", id: null as string | null }];

    for (const bg of bracketGroups) {
      if (detail.tournament.mode === "individual") {
        detail.registrations
          .filter((r) => r.status === "registered" && (bg.id === null || r.bracketId === bg.id))
          .slice(0, 3)
          .forEach((row, idx) => {
            finalStandings.push({ bracket: bg.name, place: idx + 1, userId: row.userId, wins: row.wins, losses: row.losses, points: row.points, power: row.verifiedSquadPower });
          });
      } else {
        detail.teams
          .filter((tm) => tm.status === "active" && (bg.id === null || tm.bracketId === bg.id))
          .slice(0, 3)
          .forEach((row, idx) => {
            finalStandings.push({ bracket: bg.name, place: idx + 1, teamId: row.id, teamName: row.name, wins: row.wins, losses: row.losses, points: row.points });
          });
      }
    }

    const weeks = Array.isArray(t.weeks)
      ? (t.weeks as Array<Record<string, unknown>>).map((w) => ({
          ...w,
          status: "closed",
          closedAt: w.closedAt || now,
        }))
      : [];

    await tournaments.updateOne(
      { _id: oid },
      {
        $set: {
          status: "completed",
          completedAt: now,
          standingsFrozen: true,
          finishedWithUnresolvedMatches: pending > 0,
          finalStandings,
          finalStandingsFrozenAt: now,
          finalAnnouncementSent: false,
          weeks,
          updatedAt: now,
        },
      }
    );
    await writeAuditLog({
      guildId: String(t.guildId),
      actorId,
      action: "tournament.finish",
      targetType: "Tournament",
      targetId: id,
      details: { force: Boolean(d.force), pending, placements: finalStandings.length },
    });
    return NextResponse.json({ ok: true, placements: finalStandings.length });
  }

  if (d.action === "cancel") {
    await tournaments.updateOne({ _id: oid }, { $set: { status: "cancelled", cancelledAt: now, cancelReason: d.reason || "", updatedAt: now } });
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "tournament.cancel", targetType: "Tournament", targetId: id, details: { reason: d.reason || "" } });
    return NextResponse.json({ ok: true });
  }

  if (d.action === "archive") {
    if (!["completed", "cancelled"].includes(String(t.status))) {
      return NextResponse.json({ error: "Only completed or cancelled tournaments can be archived." }, { status: 400 });
    }
    await tournaments.updateOne({ _id: oid }, { $set: { status: "archived", updatedAt: now } });
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "tournament.archive", targetType: "Tournament", targetId: id });
    return NextResponse.json({ ok: true });
  }

  if (d.action === "add_bracket") {
    if (!d.bracket) return NextResponse.json({ error: "Bracket data required." }, { status: 400 });
    if (t.settingsLocked || !["draft", "registration"].includes(String(t.status))) {
      return NextResponse.json({ error: "Brackets are locked after start." }, { status: 400 });
    }
    if (!t.bracketsEnabled) return NextResponse.json({ error: "Brackets are disabled." }, { status: 400 });
    const maxP = d.bracket.maxPower ?? null;
    if (maxP !== null && maxP < d.bracket.minPower) {
      return NextResponse.json({ error: "Max power must be >= min power." }, { status: 400 });
    }
    const existing = Array.isArray(t.brackets) ? t.brackets : [];
    if (
      !d.bracket.allowOverlap &&
      existing.some((b: { minPower: number; maxPower?: number | null }) =>
        bracketsOverlap(d.bracket!.minPower, maxP, Number(b.minPower), b.maxPower ?? null)
      )
    ) {
      return NextResponse.json({ error: "Range overlaps an existing bracket." }, { status: 400 });
    }
    await tournaments.updateOne(
      { _id: oid },
      { $push: { brackets: { _id: new ObjectId(), name: d.bracket.name, minPower: d.bracket.minPower, maxPower: maxP, placementRules: "standard" } } as never, $set: { updatedAt: now } }
    );
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "bracket.add", targetType: "Tournament", targetId: id, details: { bracket: d.bracket.name } });
    return NextResponse.json({ ok: true });
  }

  if (d.action === "delete_bracket") {
    if (!d.bracketName) return NextResponse.json({ error: "bracketName required." }, { status: 400 });
    if (t.settingsLocked || !["draft", "registration"].includes(String(t.status))) {
      return NextResponse.json({ error: "Brackets are locked after start." }, { status: 400 });
    }
    await tournaments.updateOne({ _id: oid }, { $pull: { brackets: { name: d.bracketName } } as never, $set: { updatedAt: now } });
    await writeAuditLog({ guildId: String(t.guildId), actorId, action: "bracket.delete", targetType: "Tournament", targetId: id, details: { name: d.bracketName } });
    return NextResponse.json({ ok: true });
  }

  if (t.settingsLocked) {
    return NextResponse.json({ error: "Tournament settings are locked once play begins." }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: now };
  if (d.name !== undefined) { updates.name = d.name; updates.nameLower = d.name.toLowerCase(); }
  if (d.description !== undefined) updates.description = d.description;
  if (d.maps !== undefined) updates.maps = d.maps;
  if (d.scoring !== undefined) updates.scoring = d.scoring;
  if (d.proofRequired !== undefined) updates["resultPolicy.proofRequired"] = d.proofRequired;
  if (d.approvalRequired !== undefined) updates["resultPolicy.approvalRequired"] = d.approvalRequired;
  if (d.allowDraws !== undefined) updates["resultPolicy.allowDraws"] = d.allowDraws;
  if (d.allowIncompleteTeams !== undefined) updates.allowIncompleteTeams = d.allowIncompleteTeams;
  if (d.teamInvitesOnly !== undefined) updates.teamInvitesOnly = d.teamInvitesOnly;
  if (d.swissRounds !== undefined) updates.swissRounds = d.swissRounds;
  if (d.seriesBestOf !== undefined) updates.seriesBestOf = d.seriesBestOf;
  if (d.matchDeadlineHours !== undefined) updates["schedule.matchDeadlineHours"] = d.matchDeadlineHours;
  if (d.matchDurationMinutes !== undefined) updates["schedule.matchDurationMinutes"] = d.matchDurationMinutes;
  if (d.prizes !== undefined) updates.prizeDescriptions = d.prizes;

  await tournaments.updateOne({ _id: oid }, { $set: updates });
  await writeAuditLog({ guildId: String(t.guildId), actorId, action: "tournament.configure", targetType: "Tournament", targetId: id, details: updates });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await context.params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });

  const { tournaments, registrations, teams, matches, tickets, seriesRecords } =
    await getCollections();
  const t = await tournaments.findOne({ _id: oid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const { access } = await resolveTournamentAccess(session, t);
  if (!access.canDeleteTournament) {
    return NextResponse.json(
      { error: "Only the Server Owner or Tournament Owner can delete this tournament." },
      { status: 403 }
    );
  }

  if ((await matches.countDocuments({ tournamentId: oid, status: "disputed" })) > 0) {
    return NextResponse.json({ error: "Deletion blocked: resolve disputed matches first." }, { status: 400 });
  }

  await Promise.all([
    registrations.deleteMany({ tournamentId: oid }),
    teams.deleteMany({ tournamentId: oid }),
    matches.deleteMany({ tournamentId: oid }),
    tickets.deleteMany({ tournamentId: oid }),
    seriesRecords.deleteMany({ tournamentId: oid }),
    tournaments.deleteOne({ _id: oid }),
  ]);

  await writeAuditLog({
    guildId: String(t.guildId),
    actorId: session.user.discordId || session.user.sub,
    action: "tournament.delete",
    targetType: "Tournament",
    targetId: id,
    details: { name: t.name },
  });
  return NextResponse.json({ ok: true });
}

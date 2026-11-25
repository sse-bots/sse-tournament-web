import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getCollections, toIso, writeAuditLog } from "@/lib/mongodb";
import {
  extractGuildChannels,
  extractGuildRoles,
  resolveServerAccess,
} from "@/lib/rbac";
import { hydrateTournamentSummary } from "@/lib/tournament-service";
import type { ServerSettingsData } from "@/lib/tournament-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateServerSettingsSchema = z.object({
  defaultModeratorRoleIds: z.array(z.string().trim().min(1)).max(20).optional(),
  supportStaffRoleId: z.string().trim().optional().nullable(),
  logChannelId: z.string().trim().optional().nullable(),
  announcementChannelId: z.string().trim().optional().nullable(),
});

export async function GET(
  _req: Request,
  context: { params: Promise<{ guildId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { guildId } = await context.params;
  const { access, discordGuild, guildCfg } = await resolveServerAccess(
    session,
    guildId
  );

  if (!access.isMember) {
    return NextResponse.json(
      { error: "You are not a member of this Discord server." },
      { status: 403 }
    );
  }

  const { games, tournaments, registrations, matches, tickets } =
    await getCollections();

  const [
    activeGames,
    recentTourneyDocs,
    totalTournaments,
    liveTournaments,
    openTournaments,
    totalRegistrations,
    pendingPower,
    pendingMatches,
    openTickets,
  ] = await Promise.all([
    games.find({ guildId, active: true }).sort({ name: 1 }).toArray(),
    tournaments
      .find({ guildId, status: { $ne: "archived" } })
      .sort({ createdAt: -1 })
      .limit(8)
      .toArray(),
    tournaments.countDocuments({ guildId, status: { $ne: "archived" } }),
    tournaments.countDocuments({ guildId, status: "in_progress" }),
    tournaments.countDocuments({ guildId, status: "registration" }),
    registrations.countDocuments({ guildId, status: "registered" }),
    registrations.countDocuments({
      guildId,
      status: "registered",
      squadPowerStatus: "pending",
    }),
    matches.countDocuments({
      guildId,
      status: { $in: ["pending_review", "disputed"] },
    }),
    tickets.countDocuments({
      guildId,
      status: { $nin: ["closed", "resolved"] },
    }),
  ]);

  const gameMap = new Map(activeGames.map((g) => [String(g._id), String(g.name)]));
  const recentTournaments = await Promise.all(
    recentTourneyDocs.map((doc) => hydrateTournamentSummary(doc, gameMap))
  );

  const lastSyncIso = toIso(guildCfg?.botLastSyncAt);
  const botOnline = Boolean(
    guildCfg?.botOnline &&
      lastSyncIso &&
      Date.now() - new Date(lastSyncIso).getTime() < 1000 * 60 * 15
  );

  const channelsObj = (guildCfg?.channels || {}) as Record<string, string>;
  const iconUrl = discordGuild?.icon
    ? `https://cdn.discordapp.com/icons/${guildId}/${discordGuild.icon}.png?size=128`
    : typeof guildCfg?.guildIcon === "string"
      ? guildCfg.guildIcon
      : null;

  const settings: ServerSettingsData = {
    guildId,
    guildName:
      discordGuild?.name ||
      (typeof guildCfg?.guildName === "string"
        ? guildCfg.guildName
        : `Server ${guildId.slice(-6)}`),
    guildIcon: iconUrl,
    ownerId: typeof guildCfg?.ownerId === "string" ? guildCfg.ownerId : null,
    botOnline,
    botLastSyncAt: lastSyncIso,
    categoryId:
      typeof guildCfg?.categoryId === "string" ? guildCfg.categoryId : null,
    logChannelId:
      typeof guildCfg?.logChannelId === "string" ? guildCfg.logChannelId : null,
    announcementChannelId:
      typeof guildCfg?.announcementChannelId === "string"
        ? guildCfg.announcementChannelId
        : channelsObj.announcements || null,
    supportStaffRoleId:
      typeof guildCfg?.supportStaffRoleId === "string"
        ? guildCfg.supportStaffRoleId
        : null,
    defaultModeratorRoleIds: Array.isArray(guildCfg?.defaultModeratorRoleIds)
      ? guildCfg.defaultModeratorRoleIds.map(String)
      : [],
    discordRoles: extractGuildRoles(guildCfg),
    discordChannels: extractGuildChannels(guildCfg),
  };

  return NextResponse.json(
    {
      access,
      settings,
      stats: {
        totalTournaments,
        liveTournaments,
        openTournaments,
        totalGames: activeGames.length,
        totalRegistrations,
        pendingPower,
        pendingMatches,
        openTickets,
        memberCount: Number(guildCfg?.memberCount ?? 0),
      },
      recentTournaments,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ guildId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { guildId } = await context.params;
  const { access } = await resolveServerAccess(session, guildId);
  if (!access.canManageServerSettings) {
    return NextResponse.json(
      { error: "Only the Discord Server Owner can change server settings." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = updateServerSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid settings payload." },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (d.defaultModeratorRoleIds !== undefined) {
    updates.defaultModeratorRoleIds = Array.from(new Set(d.defaultModeratorRoleIds));
  }
  if (d.supportStaffRoleId !== undefined) {
    updates.supportStaffRoleId = d.supportStaffRoleId || null;
  }
  if (d.logChannelId !== undefined) {
    updates.logChannelId = d.logChannelId || null;
  }
  if (d.announcementChannelId !== undefined) {
    updates.announcementChannelId = d.announcementChannelId || null;
  }

  const { guildConfig } = await getCollections();
  await guildConfig.updateOne({ guildId }, { $set: updates }, { upsert: true });

  await writeAuditLog({
    guildId,
    actorId: session.user.discordId || session.user.sub,
    action: "server.settings_updated",
    targetType: "Guild",
    targetId: guildId,
    details: updates,
  });

  return NextResponse.json({ ok: true });
}

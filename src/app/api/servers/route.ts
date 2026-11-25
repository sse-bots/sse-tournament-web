import { NextResponse } from "next/server";
import { fetchUserDiscordGuilds, getSession } from "@/lib/auth";
import { getCollections, toIso } from "@/lib/mongodb";
import { isEnvPlatformAdmin, userHasAnyRoleInGuildConfig } from "@/lib/rbac";
import type { ServerAccessRole, ServerWorkspaceSummary } from "@/lib/tournament-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const [{ guildConfig, tournaments, games, tickets }, discordGuilds] =
    await Promise.all([
      getCollections(),
      fetchUserDiscordGuilds(session.accessToken),
    ]);

  const discordId = session.user.discordId;
  const isPlatformAdmin = isEnvPlatformAdmin(discordId);

  const guildIdSet = new Set<string>(discordGuilds.map((g) => String(g.id)));

  // If platform admin, also surface all configured bot guilds in MongoDB
  if (isPlatformAdmin) {
    const allCfgs = await guildConfig.find({}, { projection: { guildId: 1 } }).toArray();
    for (const c of allCfgs) {
      if (c.guildId) guildIdSet.add(String(c.guildId));
    }
  }

  const guildIds = Array.from(guildIdSet);
  if (guildIds.length === 0) {
    return NextResponse.json({ servers: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const [cfgDocs, tourneyDocs, gameAgg, ticketAgg] = await Promise.all([
    guildConfig.find({ guildId: { $in: guildIds } }).toArray(),
    tournaments
      .find(
        { guildId: { $in: guildIds }, status: { $ne: "archived" } },
        {
          projection: {
            guildId: 1,
            status: 1,
            ownerId: 1,
            managerRoleIds: 1,
            reviewerRoleIds: 1,
            headManagerRoleIds: 1,
          },
        }
      )
      .toArray(),
    games
      .aggregate([
        { $match: { guildId: { $in: guildIds }, active: true } },
        { $group: { _id: "$guildId", count: { $sum: 1 } } },
      ])
      .toArray(),
    tickets
      .aggregate([
        { $match: { guildId: { $in: guildIds }, status: { $nin: ["closed", "resolved"] } } },
        { $group: { _id: "$guildId", count: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const cfgMap = new Map(cfgDocs.map((c) => [String(c.guildId), c]));
  const discordMap = new Map(discordGuilds.map((g) => [String(g.id), g]));
  const gameCountMap = new Map(gameAgg.map((r) => [String(r._id), Number(r.count)]));
  const ticketCountMap = new Map(ticketAgg.map((r) => [String(r._id), Number(r.count)]));

  // Pre-group tournament counts & moderator role IDs per guild
  const statsByGuild = new Map<
    string,
    { total: number; live: number; open: number; modRoleIds: Set<string>; ownsAnyTourney: boolean }
  >();
  for (const t of tourneyDocs) {
    const gid = String(t.guildId || "");
    let entry = statsByGuild.get(gid);
    if (!entry) {
      entry = { total: 0, live: 0, open: 0, modRoleIds: new Set(), ownsAnyTourney: false };
      statsByGuild.set(gid, entry);
    }
    entry.total += 1;
    if (t.status === "in_progress") entry.live += 1;
    if (t.status === "registration") entry.open += 1;
    if (discordId && String(t.ownerId || "") === String(discordId)) {
      entry.ownsAnyTourney = true;
    }
    for (const f of ["managerRoleIds", "reviewerRoleIds", "headManagerRoleIds"] as const) {
      if (Array.isArray(t[f])) {
        for (const rid of t[f]) entry.modRoleIds.add(String(rid));
      }
    }
  }

  const nowMs = Date.now();
  const servers: ServerWorkspaceSummary[] = guildIds.map((gid) => {
    const dg = discordMap.get(gid);
    const cfg = cfgMap.get(gid);
    const st = statsByGuild.get(gid);

    const lastSyncIso = toIso(cfg?.botLastSyncAt);
    const lastSyncMs = lastSyncIso ? new Date(lastSyncIso).getTime() : 0;
    const botOnline = Boolean(
      cfg?.botOnline && lastSyncMs > 0 && nowMs - lastSyncMs < 1000 * 60 * 15
    );
    const botConfigured = Boolean(cfg || (st && st.total > 0) || (gameCountMap.get(gid) || 0) > 0);

    const isOwner = Boolean(
      isPlatformAdmin ||
        dg?.owner === true ||
        (discordId && cfg?.ownerId && String(cfg.ownerId) === String(discordId))
    );

    const modRoles = new Set<string>(st ? Array.from(st.modRoleIds) : []);
    if (Array.isArray(cfg?.defaultModeratorRoleIds)) {
      for (const r of cfg.defaultModeratorRoleIds) modRoles.add(String(r));
    }
    if (cfg?.supportStaffRoleId) modRoles.add(String(cfg.supportStaffRoleId));

    const isMod = Boolean(
      !isOwner &&
        (st?.ownsAnyTourney ||
          userHasAnyRoleInGuildConfig(cfg, discordId, Array.from(modRoles)))
    );

    const role: ServerAccessRole = isOwner ? "owner" : isMod ? "moderator" : "member";
    const iconUrl = dg?.icon
      ? `https://cdn.discordapp.com/icons/${gid}/${dg.icon}.png?size=128`
      : typeof cfg?.guildIcon === "string"
        ? cfg.guildIcon
        : null;

    return {
      id: gid,
      name: dg?.name || (typeof cfg?.guildName === "string" ? cfg.guildName : `Server ${gid.slice(-6)}`),
      icon: iconUrl,
      owner: isOwner,
      role,
      botConfigured,
      botOnline,
      botLastSyncAt: lastSyncIso,
      memberCount: Number(cfg?.memberCount ?? 0),
      tournamentCount: st?.total || 0,
      liveTournamentCount: st?.live || 0,
      openRegistrationCount: st?.open || 0,
      gameCount: gameCountMap.get(gid) || 0,
      openTicketCount: ticketCountMap.get(gid) || 0,
    };
  });

  // Sort: Bot Active first, then Owner -> Moderator -> Member, then most tournaments
  const roleWeight: Record<ServerAccessRole, number> = {
    owner: 3,
    moderator: 2,
    member: 1,
  };
  servers.sort(
    (a, b) =>
      Number(b.botConfigured) - Number(a.botConfigured) ||
      Number(b.botOnline) - Number(a.botOnline) ||
      roleWeight[b.role] - roleWeight[a.role] ||
      b.tournamentCount - a.tournamentCount ||
      a.name.localeCompare(b.name)
  );

  return NextResponse.json({ servers }, { headers: { "Cache-Control": "no-store" } });
}

import type { Document, ObjectId } from "mongodb";
import {
  fetchUserDiscordGuilds,
  type DiscordGuildRaw,
  type StoredSession,
} from "./auth";
import { getCollections } from "./mongodb";
import type {
  GuildChannelInfo,
  GuildRoleInfo,
  ServerAccessContext,
  ServerAccessRole,
  TournamentAccessContext,
} from "./tournament-types";

export function isEnvPlatformAdmin(discordId: string | null | undefined): boolean {
  if (!discordId) return false;
  const envAdmins = new Set(
    (process.env.ADMIN_DISCORD_IDS || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
  );
  return envAdmins.has(String(discordId).trim());
}

export function extractGuildRoles(cfg: Document | null | undefined): GuildRoleInfo[] {
  if (!cfg || !Array.isArray(cfg.discordRoles)) return [];
  return (cfg.discordRoles as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id || ""),
    name: String(r.name || "Role"),
    color: typeof r.color === "string" ? r.color : "#94a3b8",
    position: Number(r.position ?? 0),
  }));
}

export function extractGuildChannels(cfg: Document | null | undefined): GuildChannelInfo[] {
  if (!cfg || !Array.isArray(cfg.discordChannels)) return [];
  return (cfg.discordChannels as Array<Record<string, unknown>>).map((c) => ({
    id: String(c.id || ""),
    name: String(c.name || "channel"),
    category: typeof c.category === "string" ? c.category : null,
  }));
}

export function userHasAnyRoleInGuildConfig(
  cfg: Document | null | undefined,
  discordId: string | null | undefined,
  roleIds: string[]
): boolean {
  if (!cfg || !discordId || roleIds.length === 0) return false;
  const roleMembers = (cfg.roleMembers || {}) as Record<string, unknown>;
  const target = String(discordId);
  for (const rid of roleIds) {
    const members = roleMembers[String(rid)];
    if (Array.isArray(members) && members.map(String).includes(target)) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves a signed-in user's exact role in a specific Discord server:
 * - Server Owner: `guild.owner === true` (from Discord OAuth) OR `guildConfig.ownerId === user.discordId`
 *                 (plus optional ADMIN_DISCORD_IDS platform super-override).
 *                 ONLY Server Owner can create tournaments, edit games, and edit server settings.
 * - Moderator:    User holds any default server moderator role OR any active tournament moderator/reviewer role in this server.
 * - Member:       Regular member of the Discord server (can browse Games, Tournaments, Brackets, Standings).
 */
export async function resolveServerAccess(
  session: StoredSession | null,
  guildId: string,
  preloadedGuilds?: DiscordGuildRaw[]
): Promise<{
  access: ServerAccessContext;
  discordGuild: DiscordGuildRaw | null;
  guildCfg: Document | null;
}> {
  const { guildConfig, tournaments } = await getCollections();
  const [guildCfg, discordGuilds] = await Promise.all([
    guildConfig.findOne({ guildId: String(guildId) }),
    preloadedGuilds
      ? Promise.resolve(preloadedGuilds)
      : session
        ? fetchUserDiscordGuilds(session.accessToken)
        : Promise.resolve([]),
  ]);

  const discordGuild =
    discordGuilds.find((g) => String(g.id) === String(guildId)) || null;

  if (!session) {
    return {
      access: {
        guildId: String(guildId),
        isMember: false,
        isServerOwner: false,
        isServerModerator: false,
        role: "member",
        canCreateTournament: false,
        canManageGames: false,
        canManageServerSettings: false,
        canViewStaffTools: false,
      },
      discordGuild: null,
      guildCfg,
    };
  }

  const discordId = session.user.discordId;
  const isPlatformAdmin = isEnvPlatformAdmin(discordId);
  const isServerOwner = Boolean(
    isPlatformAdmin ||
      discordGuild?.owner === true ||
      (discordId &&
        guildCfg?.ownerId &&
        String(guildCfg.ownerId) === String(discordId))
  );

  // Gather all moderator role IDs in this guild (server defaults + any non-archived tournament)
  const modRoleSet = new Set<string>();
  if (Array.isArray(guildCfg?.defaultModeratorRoleIds)) {
    for (const r of guildCfg.defaultModeratorRoleIds) modRoleSet.add(String(r));
  }
  if (guildCfg?.supportStaffRoleId) {
    modRoleSet.add(String(guildCfg.supportStaffRoleId));
  }

  let isTournamentModOrOwner = false;
  if (!isServerOwner && discordId) {
    const activeTourneys = await tournaments
      .find(
        { guildId: String(guildId), status: { $ne: "archived" } },
        { projection: { ownerId: 1, managerRoleIds: 1, reviewerRoleIds: 1, headManagerRoleIds: 1 } }
      )
      .toArray();
    for (const t of activeTourneys) {
      if (String(t.ownerId || "") === String(discordId)) {
        isTournamentModOrOwner = true;
      }
      for (const f of ["managerRoleIds", "reviewerRoleIds", "headManagerRoleIds"] as const) {
        if (Array.isArray(t[f])) {
          for (const rid of t[f]) modRoleSet.add(String(rid));
        }
      }
    }
  }

  const isServerModerator = Boolean(
    !isServerOwner &&
      (isTournamentModOrOwner ||
        userHasAnyRoleInGuildConfig(guildCfg, discordId, Array.from(modRoleSet)))
  );

  const isMember = Boolean(discordGuild || isServerOwner || isServerModerator);
  const role: ServerAccessRole = isServerOwner
    ? "owner"
    : isServerModerator
      ? "moderator"
      : "member";

  return {
    access: {
      guildId: String(guildId),
      isMember,
      isServerOwner,
      isServerModerator,
      role,
      canCreateTournament: isServerOwner,
      canManageGames: isServerOwner,
      canManageServerSettings: isServerOwner,
      canViewStaffTools: isServerOwner || isServerModerator,
    },
    discordGuild,
    guildCfg,
  };
}

/**
 * Resolves a signed-in user's exact permissions inside a specific tournament:
 * - Only the Server Owner / Tournament Owner can assign/remove Moderator roles or delete the tournament.
 * - Assigned Moderators (holding managerRoleIds / reviewerRoleIds / headManagerRoleIds / defaultModeratorRoleIds)
 *   receive full admin management tools UNLESS they are registered as a participant (Fair-Play Lock!).
 */
export async function resolveTournamentAccess(
  session: StoredSession | null,
  tournamentDoc: Document,
  preloadedGuilds?: DiscordGuildRaw[]
): Promise<{
  access: TournamentAccessContext;
  guildCfg: Document | null;
}> {
  const guildId = String(tournamentDoc.guildId || "");
  const tid = tournamentDoc._id as ObjectId;
  const tidStr = String(tid);

  const [{ access: serverAccess, guildCfg }, { registrations }] =
    await Promise.all([
      resolveServerAccess(session, guildId, preloadedGuilds),
      getCollections(),
    ]);

  if (!session) {
    return {
      access: {
        guildId,
        tournamentId: tidStr,
        isServerOwner: false,
        isTournamentOwner: false,
        isModerator: false,
        isFairPlayLocked: false,
        role: "member",
        canAssignModerators: false,
        canManageTournament: false,
        canDeclareResults: false,
        canDeleteTournament: false,
      },
      guildCfg,
    };
  }

  const discordId = session.user.discordId;
  const isServerOwner = serverAccess.isServerOwner;
  const isTournamentOwner = Boolean(
    isServerOwner ||
      (discordId && String(tournamentDoc.ownerId || "") === String(discordId)) ||
      String(tournamentDoc.ownerId || "") === String(session.user.sub)
  );

  const tourneyRoleIds: string[] = [];
  for (const field of ["managerRoleIds", "reviewerRoleIds", "headManagerRoleIds"] as const) {
    if (Array.isArray(tournamentDoc[field])) {
      for (const r of tournamentDoc[field]) tourneyRoleIds.push(String(r));
    }
  }
  if (Array.isArray(guildCfg?.defaultModeratorRoleIds)) {
    for (const r of guildCfg.defaultModeratorRoleIds) tourneyRoleIds.push(String(r));
  }

  const hasModRole = userHasAnyRoleInGuildConfig(guildCfg, discordId, tourneyRoleIds);
  const isModerator = Boolean(!isTournamentOwner && hasModRole);

  // Fair-Play Lock: check if user is registered as a participant in this tournament
  let isRegisteredParticipant = false;
  if (discordId) {
    const reg = await registrations.findOne({
      tournamentId: tid,
      userId: String(discordId),
      status: "registered",
    });
    isRegisteredParticipant = Boolean(reg);
  }

  // Fair-play guard applies to moderators (and tournament owners if registered, matching bot.py require_manager)
  const isFairPlayLocked = Boolean(
    (isModerator || isTournamentOwner) &&
      !isEnvPlatformAdmin(discordId) &&
      isRegisteredParticipant
  );

  const canManage = (isTournamentOwner || isModerator) && !isFairPlayLocked;
  const role: ServerAccessRole = isTournamentOwner
    ? "owner"
    : isModerator
      ? "moderator"
      : "member";

  return {
    access: {
      guildId,
      tournamentId: tidStr,
      isServerOwner,
      isTournamentOwner,
      isModerator,
      isFairPlayLocked,
      role,
      canAssignModerators: isTournamentOwner,
      canManageTournament: canManage,
      canDeclareResults: canManage,
      canDeleteTournament: isTournamentOwner && !isFairPlayLocked,
    },
    guildCfg,
  };
}

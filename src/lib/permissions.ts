import { headers } from "next/headers";
import { ObjectId, Document } from "mongodb";
import { getAuth } from "./auth";
import { getCollections } from "./mongo";
import { SessionActor } from "./types";

function parseBotAdminIds(): Set<string> {
  return new Set(
    (process.env.BOT_ADMIN_DISCORD_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export async function getSessionActor(
  requestedGuildId?: string | null
): Promise<SessionActor | null> {
  try {
    const auth = getAuth();
    const hdrs = await headers();
    const session = await auth.api.getSession({ headers: hdrs });
    if (!session?.user) return null;

    const u = session.user as Record<string, unknown>;
    const discordId = String(u.discordId || u.id || "");
    let roleIds: string[] = [];
    try {
      const parsed = JSON.parse(String(u.roleIdsJson || "[]"));
      if (Array.isArray(parsed)) roleIds = parsed.map(String);
    } catch {
      roleIds = [];
    }

    const adminSet = parseBotAdminIds();
    const nexusRole = String(u.nexusRole || "").toLowerCase();
    const isBotAdmin =
      adminSet.has(discordId) ||
      nexusRole === "admin" ||
      nexusRole === "owner" ||
      nexusRole === "superadmin";

    const activeGuildId =
      requestedGuildId ||
      hdrs.get("x-sse-guild-id") ||
      process.env.DEFAULT_GUILD_ID ||
      "";

    return {
      id: String(u.id),
      discordId,
      name: String(u.name || "Competitor"),
      email: String(u.email || ""),
      image: u.image ? String(u.image) : null,
      roleIds,
      isBotAdmin,
      activeGuildId,
    };
  } catch (err) {
    console.error("[sse-auth] getSessionActor error:", err);
    return null;
  }
}

export async function isRegisteredParticipant(
  tournamentId: ObjectId,
  discordId: string
): Promise<Document | null> {
  const { registrations } = await getCollections();
  return registrations.findOne({
    tournamentId,
    userId: String(discordId),
    status: "registered",
  });
}

export function hasManagerRole(actor: SessionActor, tournament: Document): boolean {
  if (actor.isBotAdmin) return true;
  if (String(tournament.ownerId) === actor.discordId) return true;
  const managerRoles = new Set<string>(
    Array.isArray(tournament.managerRoleIds) ? tournament.managerRoleIds.map(String) : []
  );
  return actor.roleIds.some((rid) => managerRoles.has(rid));
}

export async function canManageTournament(
  actor: SessionActor | null,
  tournament: Document
): Promise<{ allowed: boolean; reason?: string; suspendedByParticipation?: boolean }> {
  if (!actor) return { allowed: false, reason: "Sign in with SSE Nexus first." };
  if (!hasManagerRole(actor, tournament)) {
    return { allowed: false, reason: "You are not authorized to manage this tournament." };
  }
  const participant = await isRegisteredParticipant(tournament._id as ObjectId, actor.discordId);
  if (participant) {
    return {
      allowed: false,
      suspendedByParticipation: true,
      reason:
        "You are registered as a participant, so manager actions are disabled for this tournament.",
    };
  }
  return { allowed: true };
}

export async function canReviewTournamentResult(
  actor: SessionActor | null,
  tournament: Document
): Promise<{ allowed: boolean; reason?: string }> {
  if (!actor) return { allowed: false, reason: "Sign in with SSE Nexus first." };
  let roleAllowed = actor.isBotAdmin || String(tournament.ownerId) === actor.discordId;
  if (!roleAllowed) {
    const allowedRoles = new Set<string>([
      ...(Array.isArray(tournament.managerRoleIds) ? tournament.managerRoleIds.map(String) : []),
      ...(Array.isArray(tournament.reviewerRoleIds) ? tournament.reviewerRoleIds.map(String) : []),
      ...(Array.isArray(tournament.headManagerRoleIds)
        ? tournament.headManagerRoleIds.map(String)
        : []),
    ]);
    roleAllowed = actor.roleIds.some((rid) => allowedRoles.has(rid));
  }
  if (!roleAllowed) {
    return {
      allowed: false,
      reason: "A tournament manager, result reviewer, or head manager role is required.",
    };
  }
  const participant = await isRegisteredParticipant(tournament._id as ObjectId, actor.discordId);
  if (participant) {
    return {
      allowed: false,
      reason: "Registered participants cannot review results in the same tournament.",
    };
  }
  return { allowed: true };
}

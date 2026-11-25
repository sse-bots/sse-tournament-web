import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getCollections, toObjectId, writeAuditLog } from "@/lib/mongodb";
import { resolveServerAccess } from "@/lib/rbac";
import { bracketsOverlap, hydrateTournamentSummary } from "@/lib/tournament-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const initialBracketSchema = z.object({
  name: z.string().trim().min(1).max(60),
  minPower: z.number().min(0),
  maxPower: z.number().min(0).nullable().optional(),
});

const createServerTournamentSchema = z.object({
  name: z.string().trim().min(2, "Tournament name must be at least 2 characters.").max(100),
  gameId: z.string().trim().min(1, "Select a game."),
  description: z.string().trim().max(1500).optional().default(""),
  templateId: z.string().trim().optional().default("blank"),
  cloneFromId: z.string().trim().optional(),
  format: z.enum([
    "round_robin",
    "single_elimination",
    "double_elimination",
    "series",
    "swiss",
    "custom",
  ]),
  mode: z.enum(["individual", "team"]),
  scoring: z.enum(["wins", "power", "points", "combined", "win_percentage"]),
  bracketsEnabled: z.boolean().default(false),
  brackets: z.array(initialBracketSchema).max(20).optional().default([]),
  managerRoleIds: z.array(z.string().trim().min(1)).max(15).optional().default([]),
  reviewerRoleIds: z.array(z.string().trim().min(1)).max(15).optional().default([]),
  headManagerRoleIds: z.array(z.string().trim().min(1)).max(15).optional().default([]),
  awardRoleIds: z
    .object({
      first: z.string().trim().optional(),
      second: z.string().trim().optional(),
      third: z.string().trim().optional(),
    })
    .optional(),
  announcementChannelId: z.string().trim().optional().nullable(),
  teamSizeMin: z.number().int().min(1).max(20).optional().default(2),
  teamSizeMax: z.number().int().min(1).max(20).optional().default(5),
  teamPowerRule: z.enum(["average", "all_members", "captain"]).optional().default("average"),
  allowIncompleteTeams: z.boolean().optional().default(false),
  teamInvitesOnly: z.boolean().optional().default(false),
  maps: z.array(z.string().trim().min(1)).max(25).optional().default([]),
  seriesBestOf: z.number().int().min(1).max(15).optional().default(3),
  swissRounds: z.number().int().min(0).max(20).optional().default(0),
  startAt: z.string().trim().optional().nullable(),
  endAt: z.string().trim().optional().nullable(),
  matchDeadlineHours: z.number().int().min(1).max(720).optional().default(48),
  matchDurationMinutes: z.number().int().min(15).max(240).optional().default(60),
  proofRequired: z.boolean().optional().default(true),
  approvalRequired: z.boolean().optional().default(true),
  allowDraws: z.boolean().optional().default(false),
  prizes: z
    .object({
      first: z.string().trim().max(120).optional(),
      second: z.string().trim().max(120).optional(),
      third: z.string().trim().max(120).optional(),
    })
    .optional(),
});

export async function GET(
  req: Request,
  context: { params: Promise<{ guildId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { guildId } = await context.params;
  const { access } = await resolveServerAccess(session, guildId);
  if (!access.isMember) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") || "").trim();
  const format = (searchParams.get("format") || "").trim();
  const mode = (searchParams.get("mode") || "").trim();
  const q = (searchParams.get("q") || "").trim();
  const includeArchived = searchParams.get("includeArchived") === "true";

  const { tournaments, games } = await getCollections();
  const filter: Record<string, unknown> = { guildId };
  if (status && status !== "all") filter.status = status;
  else if (!includeArchived) filter.status = { $ne: "archived" };
  if (format && format !== "all") filter.format = format;
  if (mode && mode !== "all") filter.mode = mode;
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ];
  }

  const [docs, allGames] = await Promise.all([
    tournaments.find(filter).sort({ createdAt: -1 }).limit(100).toArray(),
    games.find({ guildId }).toArray(),
  ]);

  const gameMap = new Map(allGames.map((g) => [String(g._id), String(g.name)]));
  const items = await Promise.all(
    docs.map((doc) => hydrateTournamentSummary(doc, gameMap))
  );

  return NextResponse.json(
    { access, tournaments: items },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(
  req: Request,
  context: { params: Promise<{ guildId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { guildId } = await context.params;
  const { access, guildCfg } = await resolveServerAccess(session, guildId);

  // STRICT: Only the Discord Server Owner can create tournaments!
  if (!access.canCreateTournament) {
    return NextResponse.json(
      { error: "Only the Discord Server Owner can create new tournaments." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = createServerTournamentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid tournament payload." },
      { status: 400 }
    );
  }

  const d = parsed.data;
  if (d.mode === "team" && d.teamSizeMin > d.teamSizeMax) {
    return NextResponse.json(
      { error: "Minimum team size cannot exceed maximum team size." },
      { status: 400 }
    );
  }
  if (d.seriesBestOf % 2 === 0) {
    return NextResponse.json(
      { error: "Best-of series must be an odd number (1, 3, 5, etc.)." },
      { status: 400 }
    );
  }

  // Validate initial power brackets for non-overlap
  const formattedBrackets: Array<Record<string, unknown>> = [];
  if (d.bracketsEnabled && d.brackets.length > 0) {
    for (let i = 0; i < d.brackets.length; i++) {
      const b = d.brackets[i];
      const maxP = b.maxPower ?? null;
      if (maxP !== null && maxP < b.minPower) {
        return NextResponse.json(
          { error: `Bracket "${b.name}" max power must be >= min power.` },
          { status: 400 }
        );
      }
      for (const prev of formattedBrackets) {
        if (
          bracketsOverlap(
            b.minPower,
            maxP,
            Number(prev.minPower),
            prev.maxPower as number | null
          )
        ) {
          return NextResponse.json(
            { error: `Bracket "${b.name}" overlaps with "${prev.name}".` },
            { status: 400 }
          );
        }
      }
      formattedBrackets.push({
        _id: new ObjectId(),
        name: b.name,
        minPower: b.minPower,
        maxPower: maxP,
        displayOrder: i + 1,
        placementRules: "standard",
      });
    }
  }

  const gameOid = toObjectId(d.gameId);
  if (!gameOid) return NextResponse.json({ error: "Invalid game selection." }, { status: 400 });

  const { games, tournaments } = await getCollections();
  const gameDoc = await games.findOne({ _id: gameOid, guildId, active: true });
  if (!gameDoc) {
    return NextResponse.json(
      { error: "Selected game was not found in this server." },
      { status: 404 }
    );
  }

  const schedule: Record<string, unknown> = {
    matchDeadlineHours: d.matchDeadlineHours,
    matchDurationMinutes: d.matchDurationMinutes,
  };
  if (d.startAt) {
    const s = new Date(d.startAt);
    if (!Number.isNaN(s.getTime())) schedule.startAt = s;
  }
  if (d.endAt) {
    const e = new Date(d.endAt);
    if (!Number.isNaN(e.getTime())) schedule.endAt = e;
  }
  if (schedule.startAt && schedule.endAt && (schedule.endAt as Date) <= (schedule.startAt as Date)) {
    return NextResponse.json({ error: "End date must be after start date." }, { status: 400 });
  }

  const channelsObj = (guildCfg?.channels || {}) as Record<string, string>;
  const defaultMods = Array.isArray(guildCfg?.defaultModeratorRoleIds)
    ? guildCfg.defaultModeratorRoleIds.map(String)
    : [];
  const mergedManagerRoles = Array.from(
    new Set(d.managerRoleIds.length > 0 ? d.managerRoleIds : defaultMods)
  );

  const ownerId = session.user.discordId || session.user.sub;

  const result = await tournaments.insertOne({
    guildId,
    name: d.name,
    nameLower: d.name.toLowerCase(),
    gameId: gameDoc._id,
    description: d.description,
    templateId: d.templateId,
    ownerId,
    managerRoleIds: mergedManagerRoles,
    reviewerRoleIds: Array.from(new Set(d.reviewerRoleIds)),
    headManagerRoleIds: Array.from(new Set(d.headManagerRoleIds)),
    awardRoleIds: d.awardRoleIds || {},
    status: "draft",
    format: d.format,
    mode: d.mode,
    scoring: d.scoring,
    bracketsEnabled: d.bracketsEnabled,
    brackets: formattedBrackets,
    teamSizeMin: d.mode === "team" ? d.teamSizeMin : 1,
    teamSizeMax: d.mode === "team" ? d.teamSizeMax : 1,
    teamPowerRule: d.teamPowerRule,
    allowIncompleteTeams: d.allowIncompleteTeams,
    teamInvitesOnly: d.teamInvitesOnly,
    categoryId: guildCfg?.categoryId || null,
    announcementChannelId:
      d.announcementChannelId ||
      guildCfg?.announcementChannelId ||
      channelsObj.announcements ||
      null,
    maps: d.maps,
    schedule,
    resultPolicy: {
      proofRequired: d.proofRequired,
      approvalRequired: d.approvalRequired,
      allowDraws: d.allowDraws,
    },
    tieBreakers: ["wins", "head_to_head", "points"],
    swissRounds: d.swissRounds,
    seriesBestOf: d.seriesBestOf,
    allowMultipleTeams: false,
    leaderboardUpdateHours: 0,
    prizeDescriptions: d.prizes || {},
    createdAt: new Date(),
    settingsLocked: false,
  });

  await writeAuditLog({
    guildId,
    actorId: ownerId,
    action: "tournament.create",
    targetType: "Tournament",
    targetId: String(result.insertedId),
    details: { name: d.name, format: d.format, mode: d.mode, templateId: d.templateId },
  });

  if (mergedManagerRoles.length > 0 || d.reviewerRoleIds.length > 0) {
    await writeAuditLog({
      guildId,
      actorId: ownerId,
      action: "tournament.moderators_updated",
      targetType: "Tournament",
      targetId: String(result.insertedId),
      details: { managerRoleIds: mergedManagerRoles },
    });
  }

  return NextResponse.json({ ok: true, id: String(result.insertedId) }, { status: 201 });
}

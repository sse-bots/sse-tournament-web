import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getCollections, toObjectId, writeAuditLog } from "@/lib/mongodb";
import {
  canManageGuildOrTournament,
  hydrateTournamentSummary,
} from "@/lib/tournament-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createTournamentSchema = z.object({
  guildId: z.string().trim().min(5),
  name: z.string().trim().min(2).max(100),
  gameId: z.string().trim().min(1),
  description: z.string().trim().max(1000).optional().default(""),
  format: z.enum(["round_robin", "single_elimination", "double_elimination", "series", "swiss", "custom"]),
  mode: z.enum(["individual", "team"]),
  scoring: z.enum(["wins", "power", "points", "combined", "win_percentage"]),
  bracketsEnabled: z.boolean().default(false),
  managerRoleId: z.string().trim().optional().default(""),
  teamSizeMin: z.number().int().min(1).max(20).optional().default(2),
  teamSizeMax: z.number().int().min(1).max(20).optional().default(5),
  teamPowerRule: z.enum(["average", "all_members", "captain"]).optional().default("average"),
  maps: z.array(z.string().trim().min(1)).max(25).optional().default([]),
  seriesBestOf: z.number().int().min(1).max(15).optional().default(3),
  swissRounds: z.number().int().min(0).max(20).optional().default(0),
  prizes: z.object({
    first: z.string().trim().max(120).optional(),
    second: z.string().trim().max(120).optional(),
    third: z.string().trim().max(120).optional(),
  }).optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const guildId = (searchParams.get("guildId") || "").trim();
  const status = (searchParams.get("status") || "").trim();
  const format = (searchParams.get("format") || "").trim();
  const mode = (searchParams.get("mode") || "").trim();
  const q = (searchParams.get("q") || "").trim();
  const includeArchived = searchParams.get("includeArchived") === "true";

  const { tournaments, games } = await getCollections();
  const filter: Record<string, unknown> = {};

  if (guildId) filter.guildId = guildId;
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
    tournaments.find(filter).sort({ createdAt: -1 }).limit(60).toArray(),
    games.find({}).toArray(),
  ]);

  const gameMap = new Map(allGames.map((g) => [String(g._id), String(g.name)]));
  const items = await Promise.all(docs.map((doc) => hydrateTournamentSummary(doc, gameMap)));

  return NextResponse.json({ tournaments: items }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createTournamentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid tournament payload." },
      { status: 400 }
    );
  }

  const d = parsed.data;
  if (d.mode === "team" && d.teamSizeMin > d.teamSizeMax) {
    return NextResponse.json({ error: "Minimum team size cannot exceed maximum team size." }, { status: 400 });
  }
  if (d.seriesBestOf % 2 === 0) {
    return NextResponse.json({ error: "Best-of series must be an odd number." }, { status: 400 });
  }

  const allowed = await canManageGuildOrTournament(session, d.guildId);
  if (!allowed) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const gameOid = toObjectId(d.gameId);
  if (!gameOid) return NextResponse.json({ error: "Invalid game selection." }, { status: 400 });

  const { games, tournaments, guildConfig } = await getCollections();
  const gameDoc = await games.findOne({ _id: gameOid, guildId: d.guildId, active: true });
  if (!gameDoc) return NextResponse.json({ error: "Selected game not found." }, { status: 404 });

  const gcfg = (await guildConfig.findOne({ guildId: d.guildId })) || {};
  const channels = (gcfg.channels || {}) as Record<string, string>;
  const ownerId = session.user.discordId || session.user.sub;

  const result = await tournaments.insertOne({
    guildId: d.guildId,
    name: d.name,
    nameLower: d.name.toLowerCase(),
    gameId: gameDoc._id,
    description: d.description,
    ownerId,
    managerRoleIds: d.managerRoleId ? [d.managerRoleId] : [],
    status: "draft",
    format: d.format,
    mode: d.mode,
    scoring: d.scoring,
    bracketsEnabled: d.bracketsEnabled,
    brackets: [],
    teamSizeMin: d.mode === "team" ? d.teamSizeMin : 1,
    teamSizeMax: d.mode === "team" ? d.teamSizeMax : 1,
    teamPowerRule: d.teamPowerRule,
    categoryId: gcfg.categoryId || null,
    announcementChannelId: channels.announcements || null,
    maps: d.maps,
    schedule: {},
    resultPolicy: { proofRequired: true, approvalRequired: true, allowDraws: false },
    tieBreakers: ["wins", "head_to_head", "points"],
    swissRounds: d.swissRounds,
    seriesBestOf: d.seriesBestOf,
    allowMultipleTeams: false,
    leaderboardUpdateHours: 0,
    prizeDescriptions: d.prizes || {},
    createdAt: new Date(),
    settingsLocked: false,
  });

  await writeAuditLog({ guildId: d.guildId, actorId: ownerId, action: "tournament.create", targetType: "Tournament", targetId: String(result.insertedId), details: { name: d.name, format: d.format, mode: d.mode } });
  return NextResponse.json({ ok: true, id: String(result.insertedId) }, { status: 201 });
}

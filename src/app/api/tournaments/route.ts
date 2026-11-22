import { NextRequest, NextResponse } from "next/server";
import { getCollections, toObjectId, serializeDoc, writeAudit } from "@/lib/mongo";
import { getSessionActor } from "@/lib/permissions";
import { TOURNAMENT_FORMATS, TOURNAMENT_MODES, SCORING_SYSTEMS, TEAM_POWER_RULES } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { tournaments, games, registrations, teams, matches } = await getCollections();
    const sp = req.nextUrl.searchParams;
    const guildId = sp.get("guildId");
    const status = sp.get("status");
    const gameId = sp.get("gameId");
    const includeArchived = sp.get("includeArchived") === "true";

    const query: Record<string, unknown> = {};
    if (guildId) query.guildId = guildId;
    if (status && status !== "all") {
      query.status = status;
    } else if (!includeArchived) {
      query.status = { $ne: "archived" };
    }
    if (gameId) {
      const gOid = toObjectId(gameId);
      if (gOid) query.gameId = gOid;
    }

    const docs = await tournaments.find(query).sort({ createdAt: -1 }).limit(50).toArray();
    const gameDocs = await games.find({}).toArray();
    const gameMap = new Map(gameDocs.map((g) => [String(g._id), String(g.name)]));

    const enriched = await Promise.all(
      docs.map(async (t) => {
        const [regCount, approvedPower, pendingPower, teamCount, matchCount, pendingReviews, disputed] =
          await Promise.all([
            registrations.countDocuments({ tournamentId: t._id, status: "registered" }),
            registrations.countDocuments({ tournamentId: t._id, status: "registered", squadPowerStatus: "approved" }),
            registrations.countDocuments({ tournamentId: t._id, status: "registered", squadPowerStatus: "pending" }),
            teams.countDocuments({ tournamentId: t._id, status: "active" }),
            matches.countDocuments({ tournamentId: t._id }),
            matches.countDocuments({ tournamentId: t._id, status: "pending_review" }),
            matches.countDocuments({ tournamentId: t._id, status: "disputed" }),
          ]);

        return {
          ...serializeDoc(t),
          gameName: gameMap.get(String(t.gameId)) || "Unknown Game",
          counts: {
            registrations: regCount,
            approvedPower,
            pendingPower,
            teams: teamCount,
            matches: matchCount,
            pendingReviews,
            disputed,
          },
        };
      })
    );

    return NextResponse.json({ tournaments: enriched });
  } catch (err) {
    console.error("[api/tournaments GET]", err);
    return NextResponse.json({ tournaments: [], error: "Could not load tournaments." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ error: "Sign in with SSE Nexus required." }, { status: 401 });

  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const guildId = String(body.guildId || actor.activeGuildId || "").trim();
    const gameId = toObjectId(body.gameId);
    const format = String(body.format || "single_elimination");
    const mode = String(body.mode || "individual");
    const scoring = String(body.scoring || "wins");
    const bracketsEnabled = Boolean(body.bracketsEnabled);
    const description = String(body.description || "").trim();
    const teamSizeMin = Number(body.teamSizeMin ?? 2);
    const teamSizeMax = Number(body.teamSizeMax ?? 5);
    const teamPowerRule = String(body.teamPowerRule || "average");
    const managerRoleIds: string[] = Array.isArray(body.managerRoleIds)
      ? body.managerRoleIds.map((r: unknown) => String(r).trim()).filter(Boolean)
      : String(body.managerRoleIds || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

    if (!name) return NextResponse.json({ error: "Tournament name is required." }, { status: 400 });
    if (!guildId) return NextResponse.json({ error: "Discord Server (Guild) ID is required." }, { status: 400 });
    if (!gameId) return NextResponse.json({ error: "Select an active game first." }, { status: 400 });
    if (!TOURNAMENT_FORMATS.includes(format as (typeof TOURNAMENT_FORMATS)[number])) {
      return NextResponse.json({ error: "Invalid tournament format." }, { status: 400 });
    }
    if (!TOURNAMENT_MODES.includes(mode as (typeof TOURNAMENT_MODES)[number])) {
      return NextResponse.json({ error: "Invalid tournament mode." }, { status: 400 });
    }
    if (!SCORING_SYSTEMS.includes(scoring as (typeof SCORING_SYSTEMS)[number])) {
      return NextResponse.json({ error: "Invalid scoring system." }, { status: 400 });
    }
    if (mode === "team" && (teamSizeMin < 1 || teamSizeMin > teamSizeMax || teamSizeMax > 20)) {
      return NextResponse.json({ error: "Team size min must be <= max (1..20)." }, { status: 400 });
    }
    if (!TEAM_POWER_RULES.includes(teamPowerRule as (typeof TEAM_POWER_RULES)[number])) {
      return NextResponse.json({ error: "teamPowerRule must be average, all_members, or captain." }, { status: 400 });
    }

    const { games, tournaments, guildConfig } = await getCollections();
    const game = await games.findOne({ _id: gameId, guildId, active: true });
    if (!game) return NextResponse.json({ error: "Selected game not found in this server." }, { status: 404 });

    const gcfg = (await guildConfig.findOne({ guildId })) || {};
    const doc = {
      guildId,
      name,
      nameLower: name.toLowerCase(),
      gameId: game._id,
      description,
      ownerId: actor.discordId,
      managerRoleIds,
      reviewerRoleIds: [],
      headManagerRoleIds: [],
      status: "draft",
      format,
      mode,
      scoring,
      bracketsEnabled,
      brackets: [],
      teamSizeMin: mode === "team" ? teamSizeMin : 1,
      teamSizeMax: mode === "team" ? teamSizeMax : 1,
      teamPowerRule,
      categoryId: gcfg.categoryId || null,
      announcementChannelId: gcfg.channels?.announcements || null,
      maps: [],
      schedule: { matchDeadlineHours: 48, matchDurationMinutes: 60 },
      resultPolicy: { proofRequired: true, approvalRequired: true, allowDraws: false },
      tieBreakers: ["wins", "head_to_head", "points"],
      swissRounds: 0,
      seriesBestOf: 3,
      allowMultipleTeams: false,
      allowIncompleteTeams: false,
      teamInvitesOnly: false,
      teamsLocked: false,
      winWeight: 3,
      powerWeight: 0,
      pointsWeight: 1,
      leaderboardUpdateHours: 0,
      awardRoleIds: {},
      prizeDescriptions: {},
      createdAt: new Date(),
      settingsLocked: false,
    };

    const res = await tournaments.insertOne(doc);
    await writeAudit(guildId, actor.discordId, "tournament.create", "Tournament", res.insertedId, {
      name,
      format,
      mode,
      scoring,
    });
    return NextResponse.json(
      { tournament: { ...serializeDoc({ ...doc, _id: res.insertedId }), gameName: game.name } },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/tournaments POST]", err);
    return NextResponse.json({ error: "Could not create draft tournament." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getCollections } from "@/lib/mongodb";
import { hydrateTournamentSummary } from "@/lib/tournament-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { games, tournaments, registrations, teams, matches } =
      await getCollections();

    const [
      totalTournaments,
      liveTournaments,
      openTournaments,
      totalRegistrations,
      totalTeams,
      totalMatches,
      activeGames,
      recentDocs,
      allGameDocs,
    ] = await Promise.all([
      tournaments.countDocuments({ status: { $ne: "archived" } }),
      tournaments.countDocuments({ status: "in_progress" }),
      tournaments.countDocuments({ status: "registration" }),
      registrations.countDocuments({ status: "registered" }),
      teams.countDocuments({ status: "active" }),
      matches.countDocuments({}),
      games.countDocuments({ active: true }),
      tournaments
        .find({ status: { $nin: ["archived", "cancelled"] } })
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray(),
      games.find({ active: true }).toArray(),
    ]);

    const gameMap = new Map(
      allGameDocs.map((g) => [String(g._id), String(g.name)])
    );

    const featured = await Promise.all(
      recentDocs.map((doc) => hydrateTournamentSummary(doc, gameMap))
    );

    return NextResponse.json(
      {
        stats: {
          totalTournaments,
          liveTournaments,
          openTournaments,
          totalRegistrations,
          totalTeams,
          totalMatches,
          activeGames,
        },
        featured,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/overview failed:", err);
    return NextResponse.json(
      {
        stats: {
          totalTournaments: 0,
          liveTournaments: 0,
          openTournaments: 0,
          totalRegistrations: 0,
          totalTeams: 0,
          totalMatches: 0,
          activeGames: 0,
        },
        featured: [],
        dbError: true,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}

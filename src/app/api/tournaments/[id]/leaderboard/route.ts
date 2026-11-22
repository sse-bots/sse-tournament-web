import { NextRequest, NextResponse } from "next/server";
import { Document, ObjectId } from "mongodb";
import { getCollections, toObjectId, serializeDocs } from "@/lib/mongo";
import { rankRegistrationRows, teamRecordStats, teamVerifiedPower } from "@/lib/tournament-engine";

export const dynamic = "force-dynamic";

interface RankedTeamRow {
  _id: string;
  name: string;
  logoUrl: string | null;
  captainId: string;
  memberCount: number;
  bracketId: string | null;
  power: number;
  wins: number;
  losses: number;
  points: number;
  played: number;
  pct: number;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });

  const { tournaments, registrations, teams, matches } = await getCollections();
  const t = await tournaments.findOne({ _id: oid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const bracketIdParam = req.nextUrl.searchParams.get("bracketId");
  const bracketOid = toObjectId(bracketIdParam);
  const format = req.nextUrl.searchParams.get("format");

  if (format === "csv") {
    const bracketMap = new Map<string, string>(
      (Array.isArray(t.brackets) ? t.brackets : []).map((b: Document) => [String(b._id), String(b.name)])
    );
    const lines: string[] = [
      "record_type,id_or_user,in_game_or_match,status,bracket,verified_power_or_map,wins_or_round,losses_or_winner,points_or_proof,extra",
    ];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const allRegs = await registrations.find({ tournamentId: oid }).sort({ userId: 1 }).toArray();
    for (const r of allRegs) {
      lines.push(
        [
          "PLAYER",
          r.userId,
          r.inGameId || "",
          r.status,
          bracketMap.get(String(r.bracketId)) || "",
          r.verifiedSquadPower ?? "",
          r.wins || 0,
          r.losses || 0,
          r.points || 0,
          r.squadPowerStatus || "",
        ]
          .map(esc)
          .join(",")
      );
    }
    const allMatches = await matches.find({ tournamentId: oid }).sort({ matchNumber: 1 }).toArray();
    for (const m of allMatches) {
      lines.push(
        [
          "MATCH",
          String(m._id),
          `match-${m.matchNumber}`,
          m.status,
          bracketMap.get(String(m.bracketId)) || "",
          m.mapName || "",
          m.roundNumber || 1,
          m.reportedWinnerSide || "",
          m.proofUrl || "",
          m.reviewedBy || "",
        ]
          .map(esc)
          .join(",")
      );
    }

    return new NextResponse("\uFEFF" + lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tournament-${oid.toHexString()}-results.csv"`,
      },
    });
  }

  const q: Record<string, unknown> = { tournamentId: oid, status: "registered" };
  if (bracketOid) q.bracketId = bracketOid;
  const regDocs = await registrations.find(q).toArray();
  const rankedIndividuals = await rankRegistrationRows(t, regDocs);

  let rankedTeams: RankedTeamRow[] = [];
  if (t.mode === "team") {
    const tq: Record<string, unknown> = { tournamentId: oid, status: "active" };
    if (bracketOid) tq.bracketId = bracketOid;
    const teamDocs = await teams.find(tq).toArray();
    const list: RankedTeamRow[] = [];
    for (const tm of teamDocs) {
      const stats = await teamRecordStats(t, tm, bracketOid);
      const power = await teamVerifiedPower(t, tm);
      list.push({
        _id: (tm._id as ObjectId).toHexString(),
        name: String(tm.name || ""),
        logoUrl: tm.logoUrl ? String(tm.logoUrl) : null,
        captainId: String(tm.captainId || ""),
        memberCount: Array.isArray(tm.memberIds) ? tm.memberIds.length : 0,
        bracketId: tm.bracketId ? String(tm.bracketId) : null,
        power,
        ...stats,
      });
    }
    list.sort((a, b) => {
      if (t.scoring === "power") return b.power - a.power;
      if (t.scoring === "points") return b.points - a.points || b.wins - a.wins;
      if (t.scoring === "win_percentage") return b.pct - a.pct || b.wins - a.wins || b.points - a.points;
      if (t.scoring === "combined") {
        const sa =
          a.wins * Number(t.winWeight ?? 3) +
          a.power * Number(t.powerWeight ?? 0) +
          a.points * Number(t.pointsWeight ?? 1);
        const sb =
          b.wins * Number(t.winWeight ?? 3) +
          b.power * Number(t.powerWeight ?? 0) +
          b.points * Number(t.pointsWeight ?? 1);
        return sb - sa;
      }
      return b.wins - a.wins || b.points - a.points;
    });
    rankedTeams = list;
  }

  return NextResponse.json({
    standingsFrozen: Boolean(t.standingsFrozen),
    finalStandings: t.finalStandings || [],
    individuals: serializeDocs(rankedIndividuals),
    teams: rankedTeams,
  });
}

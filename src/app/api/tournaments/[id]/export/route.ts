import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCollections, toObjectId } from "@/lib/mongodb";
import { resolveTournamentAccess } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await context.params;
  const oid = toObjectId(id);
  if (!oid) {
    return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });
  }

  const { tournaments, registrations, matches } = await getCollections();
  const t = await tournaments.findOne({ _id: oid });
  if (!t) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  const { access } = await resolveTournamentAccess(session, t);
  if (!access.canManageTournament && !access.canAssignModerators) {
    return NextResponse.json(
      { error: "Owner or assigned Moderator permission required to export CSV." },
      { status: 403 }
    );
  }

  const [regs, matchDocs] = await Promise.all([
    registrations.find({ tournamentId: oid }).sort({ userId: 1 }).toArray(),
    matches.find({ tournamentId: oid }).sort({ weekNumber: 1, matchNumber: 1 }).toArray(),
  ]);

  const bracketMap = new Map<string, string>();
  if (Array.isArray(t.brackets)) {
    for (const b of t.brackets) bracketMap.set(String(b._id), String(b.name));
  }

  const lines: string[] = [];
  const pushRow = (cols: unknown[]) => lines.push(cols.map(csvCell).join(","));
  pushRow([
    "user_id",
    "in_game_id",
    "status",
    "bracket",
    "verified_average_power",
    "wins",
    "losses",
    "points",
    "power_evidence_status",
  ]);

  for (const r of regs) {
    pushRow([
      r.userId,
      r.inGameId || "",
      r.status,
      r.bracketId ? bracketMap.get(String(r.bracketId)) || "" : "",
      r.verifiedSquadPower ?? "",
      r.wins ?? 0,
      r.losses ?? 0,
      r.points ?? 0,
      r.squadPowerStatus || "",
    ]);
  }
  for (const m of matchDocs) {
    pushRow([
      "MATCH",
      String(m._id),
      `week-${m.weekNumber ?? 1}-match-${m.matchNumber}`,
      m.status,
      m.sideALabel || "",
      m.sideBLabel || "",
      m.mapName || "",
      m.reportedWinnerLabel || m.reportedWinnerSide || "",
      m.proofUrl || "",
      m.reviewedBy || "",
    ]);
  }
  if (Array.isArray(t.finalStandings)) {
    for (const row of t.finalStandings) {
      pushRow([
        "FINAL",
        row.place,
        row.userId || row.teamName || "",
        row.bracket || "",
        row.power ?? "",
        row.wins ?? 0,
        row.losses ?? 0,
        row.points ?? 0,
        "frozen",
      ]);
    }
  }

  const safeName = String(t.name || "tournament")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return new NextResponse("\uFEFF" + lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tournament-${safeName}-results.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

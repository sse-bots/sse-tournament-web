import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getCollections, toObjectId, writeAuditLog } from "@/lib/mongodb";
import { resolveTournamentAccess } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const teamActionSchema = z.object({
  teamId: z.string().min(1),
  action: z.enum(["disqualify", "reinstate"]),
  reason: z.string().trim().max(240).optional().default(""),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await context.params;
  const tid = toObjectId(id);
  if (!tid) {
    return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = teamActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid payload." },
      { status: 400 }
    );
  }

  const { tournaments, teams } = await getCollections();
  const t = await tournaments.findOne({ _id: tid });
  if (!t) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  const { access } = await resolveTournamentAccess(session, t);
  if (!access.canManageTournament) {
    return NextResponse.json(
      {
        error: access.isFairPlayLocked
          ? "Fair-Play Guard: registered participants cannot manage teams in this tournament."
          : "Moderator or Owner permission required.",
      },
      { status: 403 }
    );
  }

  const teamOid = toObjectId(parsed.data.teamId);
  if (!teamOid) {
    return NextResponse.json({ error: "Invalid team ID." }, { status: 400 });
  }
  const team = await teams.findOne({ _id: teamOid, tournamentId: tid });
  if (!team) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }

  const actorId = session.user.discordId || session.user.sub;
  const now = new Date();
  const { action, reason } = parsed.data;

  if (action === "disqualify") {
    if (!reason.trim()) {
      return NextResponse.json(
        { error: "Provide a reason for disqualifying this team." },
        { status: 400 }
      );
    }
    await teams.updateOne(
      { _id: teamOid },
      {
        $set: {
          status: "disqualified",
          disqualifiedAt: now,
          disqualifiedBy: actorId,
          disqualificationReason: reason.trim(),
          updatedAt: now,
        },
      }
    );
    await writeAuditLog({
      guildId: String(t.guildId),
      actorId,
      action: "team.disqualify",
      targetType: "Team",
      targetId: String(teamOid),
      details: { teamName: String(team.name || ""), reason: reason.trim() },
    });
    return NextResponse.json({ ok: true });
  }

  await teams.updateOne(
    { _id: teamOid },
    {
      $set: {
        status: "active",
        reinstatedAt: now,
        reinstatedBy: actorId,
        updatedAt: now,
      },
      $unset: { disqualificationReason: "" },
    }
  );
  await writeAuditLog({
    guildId: String(t.guildId),
    actorId,
    action: "team.reinstate",
    targetType: "Team",
    targetId: String(teamOid),
    details: { teamName: String(team.name || ""), reason: reason.trim() },
  });
  return NextResponse.json({ ok: true });
}

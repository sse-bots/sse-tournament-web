import { NextRequest, NextResponse } from "next/server";
import { Document, ObjectId, WithId } from "mongodb";
import { getCollections, toObjectId, serializeDoc, writeAudit } from "@/lib/mongo";
import { getSessionActor, canManageTournament } from "@/lib/permissions";
import { rankRegistrationRows, teamRecordStats, teamVerifiedPower } from "@/lib/tournament-engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });

  const { tournaments, registrations, teams, matches, seriesRecords } = await getCollections();
  const t = await tournaments.findOne({ _id: oid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const actor = await getSessionActor(String(t.guildId));
  const check = await canManageTournament(actor, t);
  if (!check.allowed) return NextResponse.json({ error: check.reason }, { status: 403 });

  const body = await req.json();
  const action = String(body.action || "");
  const now = new Date();

  if (action === "publish" || action === "open_registration") {
    if (t.settingsLocked || !["draft", "registration_closed"].includes(String(t.status))) {
      return NextResponse.json(
        { error: "Can only publish / open registration from draft or registration_closed before start." },
        { status: 409 }
      );
    }
    if (t.bracketsEnabled && (!Array.isArray(t.brackets) || t.brackets.length === 0)) {
      return NextResponse.json(
        { error: "Brackets are enabled. Add at least one squad-power bracket before publishing." },
        { status: 400 }
      );
    }
    if (t.status === "registration_closed" && (await matches.countDocuments({ tournamentId: oid })) > 0) {
      return NextResponse.json(
        { error: "Matches already exist. Regenerate/clear unstarted matches before reopening registration." },
        { status: 409 }
      );
    }
    await tournaments.updateOne(
      { _id: oid },
      { $set: { status: "registration", registrationOpenedAt: now, teamsLocked: false, updatedAt: now } }
    );
    await writeAudit(String(t.guildId), actor!.discordId, "registration.open", "Tournament", oid);
    return NextResponse.json({ ok: true, status: "registration" });
  }

  if (action === "close_registration") {
    if (t.status !== "registration") {
      return NextResponse.json({ error: "Registration is not currently open." }, { status: 409 });
    }
    await tournaments.updateOne(
      { _id: oid },
      { $set: { status: "registration_closed", registrationClosedAt: now, teamsLocked: true, updatedAt: now } }
    );
    await writeAudit(String(t.guildId), actor!.discordId, "registration.close", "Tournament", oid);
    return NextResponse.json({ ok: true, status: "registration_closed" });
  }

  if (action === "start") {
    if (!["registration_closed", "matchmaking"].includes(String(t.status))) {
      return NextResponse.json({ error: "Close registration before starting." }, { status: 409 });
    }
    if ((await matches.countDocuments({ tournamentId: oid })) === 0) {
      return NextResponse.json({ error: "Generate matchmaking or create custom matches before starting." }, { status: 400 });
    }
    await tournaments.updateOne(
      { _id: oid },
      { $set: { status: "in_progress", settingsLocked: true, teamsLocked: true, startedAt: now, updatedAt: now } }
    );
    await writeAudit(String(t.guildId), actor!.discordId, "tournament.start", "Tournament", oid);
    return NextResponse.json({ ok: true, status: "in_progress" });
  }

  if (action === "pause") {
    if (t.status !== "in_progress") return NextResponse.json({ error: "Only an in-progress tournament can be paused." }, { status: 409 });
    await tournaments.updateOne(
      { _id: oid },
      { $set: { status: "paused", pausedAt: now, pauseReason: String(body.reason || ""), updatedAt: now } }
    );
    await writeAudit(String(t.guildId), actor!.discordId, "tournament.pause", "Tournament", oid, { reason: body.reason || "" });
    return NextResponse.json({ ok: true, status: "paused" });
  }

  if (action === "resume") {
    if (t.status !== "paused") return NextResponse.json({ error: "Tournament is not paused." }, { status: 409 });
    await tournaments.updateOne({ _id: oid }, { $set: { status: "in_progress", resumedAt: now, updatedAt: now } });
    await writeAudit(String(t.guildId), actor!.discordId, "tournament.resume", "Tournament", oid);
    return NextResponse.json({ ok: true, status: "in_progress" });
  }

  if (action === "finish") {
    if (!["in_progress", "paused"].includes(String(t.status))) {
      return NextResponse.json({ error: "Only an in-progress or paused tournament can be finished." }, { status: 409 });
    }
    const pendingMatches = await matches.countDocuments({
      tournamentId: oid,
      status: { $in: ["scheduled", "ready", "in_progress", "pending_review", "rejected", "disputed", "postponed"] },
    });
    const pendingSeries =
      t.format === "series"
        ? await seriesRecords.countDocuments({ tournamentId: oid, status: "disputed" })
        : 0;
    const totalPending = pendingMatches + pendingSeries;
    if (totalPending > 0 && !body.force) {
      return NextResponse.json(
        { error: `There are ${totalPending} unresolved matches. Resolve them or enable Force Finish.` },
        { status: 409 }
      );
    }

    const bracketGroups: Array<{ name: string; id: ObjectId | null }> = t.bracketsEnabled
      ? (t.brackets || []).map((b: Record<string, unknown>) => ({ name: String(b.name), id: b._id as ObjectId }))
      : [{ name: "Overall", id: null }];

    const finalSnapshot: Array<Record<string, unknown>> = [];

    for (const grp of bracketGroups) {
      if (t.mode === "individual") {
        const q: Record<string, unknown> = { tournamentId: oid, status: "registered" };
        if (grp.id) q.bracketId = grp.id;
        const ranked = await rankRegistrationRows(t, await registrations.find(q).toArray());
        ranked.slice(0, 3).forEach((row, idx) => {
          finalSnapshot.push({
            bracket: grp.name,
            place: idx + 1,
            userId: row.userId,
            wins: row.wins || 0,
            losses: row.losses || 0,
            points: row.points || 0,
            power: row.verifiedSquadPower ?? null,
          });
        });
      } else {
        const tq: Record<string, unknown> = { tournamentId: oid, status: "active" };
        if (grp.id) tq.bracketId = grp.id;
        const teamDocs = await teams.find(tq).toArray();
        const rows: Array<{
          team: WithId<Document>;
          wins: number;
          losses: number;
          points: number;
          played: number;
          pct: number;
          pwr: number;
        }> = [];
        for (const tm of teamDocs) {
          const st = await teamRecordStats(t, tm, grp.id);
          const pwr = await teamVerifiedPower(t, tm);
          if (st.played > 0) rows.push({ team: tm, ...st, pwr });
        }
        rows.sort((a, b) => {
          if (t.scoring === "points") return b.points - a.points || b.wins - a.wins;
          if (t.scoring === "win_percentage") return b.pct - a.pct || b.wins - a.wins || b.points - a.points;
          if (t.scoring === "power") return b.pwr - a.pwr;
          if (t.scoring === "combined") {
            const sa = a.wins * Number(t.winWeight ?? 3) + a.pwr * Number(t.powerWeight ?? 0) + a.points * Number(t.pointsWeight ?? 1);
            const sb = b.wins * Number(t.winWeight ?? 3) + b.pwr * Number(t.powerWeight ?? 0) + b.points * Number(t.pointsWeight ?? 1);
            return sb - sa;
          }
          return b.wins - a.wins || b.points - a.points;
        });
        rows.slice(0, 3).forEach((row, idx) => {
          finalSnapshot.push({
            bracket: grp.name,
            place: idx + 1,
            teamId: row.team._id.toHexString(),
            teamName: row.team.name,
            wins: row.wins,
            losses: row.losses,
            points: row.points,
          });
        });
      }
    }

    await tournaments.updateOne(
      { _id: oid },
      {
        $set: {
          status: "completed",
          completedAt: now,
          standingsFrozen: true,
          finishedWithUnresolvedMatches: totalPending > 0,
          finalStandings: finalSnapshot,
          finalStandingsFrozenAt: now,
          updatedAt: now,
        },
      }
    );
    await writeAudit(String(t.guildId), actor!.discordId, "tournament.finish", "Tournament", oid, {
      force: Boolean(body.force),
      pending: totalPending,
      placements: finalSnapshot.length,
    });
    return NextResponse.json({ ok: true, status: "completed", finalStandings: finalSnapshot });
  }

  if (action === "cancel") {
    const reason = String(body.reason || "").trim();
    if (!reason) return NextResponse.json({ error: "Provide a cancellation reason." }, { status: 400 });
    await tournaments.updateOne(
      { _id: oid },
      { $set: { status: "cancelled", cancelledAt: now, cancelReason: reason, updatedAt: now } }
    );
    await writeAudit(String(t.guildId), actor!.discordId, "tournament.cancel", "Tournament", oid, { reason });
    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  if (action === "archive") {
    if (!["completed", "cancelled"].includes(String(t.status))) {
      return NextResponse.json({ error: "Only completed or cancelled tournaments can be archived." }, { status: 409 });
    }
    await tournaments.updateOne({ _id: oid }, { $set: { status: "archived", updatedAt: now } });
    await writeAudit(String(t.guildId), actor!.discordId, "tournament.archive", "Tournament", oid);
    return NextResponse.json({ ok: true, status: "archived" });
  }

  if (action === "clone") {
    const newName = String(body.newName || `${t.name} (Copy)`).trim();
    const rest: Record<string, unknown> = { ...t };
    for (const key of [
      "_id",
      "createdAt",
      "updatedAt",
      "startedAt",
      "completedAt",
      "generatedRoundKeys",
      "bracketChampions",
      "finalStandings",
      "finalStandingsFrozenAt",
      "championDeclaredAt",
    ]) {
      delete rest[key];
    }
    const cloned = {
      ...rest,
      name: newName,
      nameLower: newName.toLowerCase(),
      status: "draft",
      settingsLocked: false,
      teamsLocked: false,
      standingsFrozen: false,
      brackets: (Array.isArray(t.brackets) ? t.brackets : []).map((b: Record<string, unknown>) => ({
        ...b,
        _id: new ObjectId(),
      })),
      createdBy: actor!.discordId,
      createdAt: now,
    };
    const res = await tournaments.insertOne(cloned);
    await writeAudit(String(t.guildId), actor!.discordId, "tournament.clone", "Tournament", res.insertedId, {
      source: oid.toHexString(),
    });
    return NextResponse.json(
      { ok: true, tournament: serializeDoc({ ...cloned, _id: res.insertedId }) },
      { status: 201 }
    );
  }

  return NextResponse.json({ error: "Unknown lifecycle action." }, { status: 400 });
}

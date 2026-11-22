import { NextRequest, NextResponse } from "next/server";
import { getCollections, toObjectId, writeAudit } from "@/lib/mongo";
import { getSessionActor, canManageTournament } from "@/lib/permissions";
import { enqueueBotEvent } from "@/lib/bot-sync";
import { buildEligibleEntrants, createMatchRecord, EntrantSeed } from "@/lib/tournament-engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });

  const { tournaments, teams, matches, seriesRecords } = await getCollections();
  const t = await tournaments.findOne({ _id: oid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const actor = await getSessionActor(String(t.guildId));
  const check = await canManageTournament(actor, t);
  if (!check.allowed) return NextResponse.json({ error: check.reason }, { status: 403 });

  const body = await req.json();
  const action = String(body.action || "preview");

  if (action === "regenerate") {
    const existing = await matches.find({ tournamentId: oid }).toArray();
    if (existing.some((m) => m.status !== "scheduled" && m.status !== "cancelled")) {
      return NextResponse.json(
        { error: "Regeneration blocked: at least one match has started, is pending review, approved, or disputed." },
        { status: 409 }
      );
    }
    const channelIds = existing
      .map((m) => (m.channelId ? String(m.channelId).trim() : ""))
      .filter(Boolean);

    await matches.deleteMany({ tournamentId: oid });
    await seriesRecords.deleteMany({ tournamentId: oid });
    await tournaments.updateOne(
      { _id: oid },
      {
        $set: { status: "registration_closed", settingsLocked: false, generatedRoundKeys: [] },
        $unset: { bracketChampions: "", finalStandings: "", finalStandingsFrozenAt: "" },
      }
    );

    if (channelIds.length > 0) {
      await enqueueBotEvent({
        guildId: String(t.guildId),
        type: "match.cleanup_channels",
        actorId: actor!.discordId,
        tournamentId: oid,
        payload: {
          channelIds,
          deleteChannels: true,
          reason: `Regenerating tournament ${oid.toHexString()} matches from Web Arena`,
        },
      });
    }

    await writeAudit(String(t.guildId), actor!.discordId, "matchmaking.regenerate", "Tournament", oid, {
      deletedMatches: existing.length,
    });
    return NextResponse.json({ ok: true, deletedMatches: existing.length });
  }

  if (action === "schedule_all") {
    const startRaw = t.schedule?.startAt;
    const endRaw = t.schedule?.endAt;
    if (!startRaw || !endRaw) {
      return NextResponse.json({ error: "Configure startAt and endAt schedule dates in Setup first." }, { status: 400 });
    }
    const start = new Date(startRaw);
    const end = new Date(endRaw);
    if (end <= start) return NextResponse.json({ error: "Schedule end must be after start." }, { status: 400 });

    const durationMins = Number(t.schedule?.matchDurationMinutes || 60);
    const deadlineHrs = Number(t.schedule?.matchDeadlineHours || 48);
    const stepMs = durationMins * 60 * 1000;

    const pending = await matches
      .find({ tournamentId: oid, status: { $in: ["scheduled", "ready", "postponed"] }, scheduledAt: { $exists: false } })
      .sort({ roundNumber: 1, matchNumber: 1 })
      .toArray();
    const existingScheduled = await matches
      .find({ tournamentId: oid, scheduledAt: { $exists: true }, status: { $nin: ["approved", "forfeited", "cancelled"] } })
      .toArray();

    const busy: Array<{ s: number; e: number; people: Set<string> }> = existingScheduled
      .filter((x) => x.scheduledAt)
      .map((x) => {
        const ms = new Date(x.scheduledAt).getTime();
        return { s: ms, e: ms + stepMs, people: new Set<string>([...(x.sideAUserIds || []), ...(x.sideBUserIds || [])]) };
      });

    let scheduledCount = 0;
    let unscheduledCount = 0;

    for (const md of pending) {
      const people: string[] = [...(md.sideAUserIds || []), ...(md.sideBUserIds || [])];
      let cand = start.getTime();
      let found: number | null = null;
      while (cand + stepMs <= end.getTime()) {
        const conflict = busy.some(
          (b) => people.some((p) => b.people.has(p)) && cand < b.e && cand + stepMs > b.s
        );
        if (!conflict) {
          found = cand;
          break;
        }
        cand += stepMs;
      }
      if (found === null) {
        unscheduledCount += 1;
        continue;
      }
      const when = new Date(found);
      const deadlineAt = new Date(found + deadlineHrs * 3600 * 1000);
      await matches.updateOne(
        { _id: md._id },
        {
          $set: {
            status: "scheduled",
            scheduledAt: when,
            deadlineAt,
            autoScheduled: true,
            autoScheduledBy: actor!.discordId,
          },
        }
      );
      busy.push({ s: found, e: found + stepMs, people: new Set(people) });
      scheduledCount += 1;
    }

    await writeAudit(String(t.guildId), actor!.discordId, "match.schedule_all", "Tournament", oid, {
      scheduled: scheduledCount,
      unscheduled: unscheduledCount,
    });
    return NextResponse.json({ ok: true, scheduled: scheduledCount, unscheduled: unscheduledCount });
  }

  if (t.format === "custom") {
    return NextResponse.json(
      { error: "Custom format uses manual matches. Create matches directly from the Matches tab." },
      { status: 400 }
    );
  }

  const sides = await buildEligibleEntrants(t);
  if (sides.length < 2) {
    return NextResponse.json(
      { error: "At least 2 eligible entrants with APPROVED squad power are required." },
      { status: 400 }
    );
  }

  const groupMap = new Map<string, EntrantSeed[]>();
  if (t.bracketsEnabled) {
    for (const s of sides) {
      const k = s.bracketId ? s.bracketId.toHexString() : "unassigned";
      if (!groupMap.has(k)) groupMap.set(k, []);
      groupMap.get(k)!.push(s);
    }
  } else {
    groupMap.set("all", sides);
  }

  if (action === "preview") {
    const preview: Array<{ bracketId: string | null; sideA: string; sideB: string; isBye: boolean }> = [];
    for (const [, grp] of groupMap.entries()) {
      if (t.format === "round_robin") {
        for (let i = 0; i < grp.length; i++) {
          for (let j = i + 1; j < grp.length; j++) {
            preview.push({
              bracketId: grp[i].bracketId ? grp[i].bracketId!.toHexString() : null,
              sideA: grp[i].name || grp[i].ids.join(", "),
              sideB: grp[j].name || grp[j].ids.join(", "),
              isBye: false,
            });
          }
        }
      } else {
        for (let i = 0; i < grp.length; i += 2) {
          const a = grp[i];
          const b = grp[i + 1];
          preview.push({
            bracketId: a.bracketId ? a.bracketId.toHexString() : null,
            sideA: a.name || a.ids.join(", "),
            sideB: b ? b.name || b.ids.join(", ") : "BYE (Auto-Advance)",
            isBye: !b,
          });
        }
      }
    }
    return NextResponse.json({ entrantCount: sides.length, format: t.format, preview });
  }

  if (action === "generate") {
    if (!["registration_closed", "matchmaking"].includes(String(t.status))) {
      return NextResponse.json({ error: "Close registration before generating matches." }, { status: 409 });
    }
    if ((await matches.countDocuments({ tournamentId: oid })) > 0) {
      return NextResponse.json({ error: "Matches already exist. Regenerate unstarted matches first." }, { status: 409 });
    }

    let matchNo = 1;
    let made = 0;

    for (const [, grp] of groupMap.entries()) {
      for (const s of grp) {
        if (s.teamId && s.bracketId) {
          await teams.updateOne({ _id: s.teamId }, { $set: { bracketId: s.bracketId, bracketAssignedAt: new Date() } });
        }
      }

      if (t.format === "round_robin") {
        const rotation: Array<EntrantSeed | null> = grp.length % 2 === 1 ? [...grp, null] : [...grp];
        const rounds = Math.max(1, rotation.length - 1);
        const half = rotation.length / 2;
        for (let r = 0; r < rounds; r++) {
          for (let i = 0; i < half; i++) {
            const left = rotation[i];
            const right = rotation[rotation.length - 1 - i];
            if (!left && !right) continue;
            const a = left || right!;
            const b = left && right ? right : { ids: [], teamId: null, power: 0, bracketId: a.bracketId };
            await createMatchRecord(t, a, b, matchNo, r + 1, a.bracketId);
            matchNo += 1;
            made += 1;
          }
          const last = rotation.pop()!;
          rotation.splice(1, 0, last);
        }
      } else {
        for (let i = 0; i < grp.length; i += 2) {
          const a = grp[i];
          const b: EntrantSeed = grp[i + 1] || { ids: [], teamId: null, power: 0, bracketId: a.bracketId };
          const bestOf = t.format === "series" && b.ids.length > 0 ? Number(t.seriesBestOf || 3) : 1;
          const seriesMeta =
            bestOf > 1
              ? { seriesId: `${oid.toHexString()}:series:${matchNo}`, seriesIndex: 1, seriesBestOf: bestOf }
              : undefined;
          await createMatchRecord(t, a, b, matchNo, 1, a.bracketId, seriesMeta);
          matchNo += 1;
          made += 1;
        }
      }
    }

    await tournaments.updateOne(
      { _id: oid },
      { $set: { status: "in_progress", settingsLocked: true, teamsLocked: true, startedAt: new Date(), updatedAt: new Date() } }
    );
    await writeAudit(String(t.guildId), actor!.discordId, "matchmaking.generate", "Tournament", oid, {
      matches: made,
      format: t.format,
    });
    await enqueueBotEvent({
      guildId: String(t.guildId),
      type: "match.sync_channels",
      actorId: actor!.discordId,
      tournamentId: oid,
    });
    return NextResponse.json({ ok: true, created: made });
  }

  return NextResponse.json({ error: "Unknown matchmaking action." }, { status: 400 });
}

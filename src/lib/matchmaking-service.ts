import type { Document, ObjectId } from "mongodb";
import { getCollections, writeAuditLog } from "./mongodb";
import { findBracketForPower } from "./tournament-service";

interface Entrant {
  ids: string[];
  teamId: ObjectId | null;
  label: string;
  power: number;
  wins: number;
  bracketId: ObjectId | null;
}

function entrantKey(ids: string[], teamId: ObjectId | null): string {
  if (teamId) return `T:${String(teamId)}`;
  return ids[0] ? `U:${ids[0]}` : "BYE";
}

function resolveRegBracket(t: Document, reg: Document): Document | null {
  if (!t.bracketsEnabled) return null;
  const brackets = Array.isArray(t.brackets) ? (t.brackets as Document[]) : [];
  if (reg.bracketOverride && reg.bracketId) {
    const found = brackets.find((b) => String(b._id) === String(reg.bracketId));
    if (found) return found;
  }
  const pwr = typeof reg.verifiedSquadPower === "number" ? reg.verifiedSquadPower : null;
  return findBracketForPower(t, pwr);
}

/**
 * Generates pairings for Week 1 or Next Week directly in MongoDB so the Web UI
 * updates immediately with clear validation errors, then queues `matchmaking.web_generate`
 * so `bot-v4.py` creates the Week Forum Channel, locked Announcement post, and tagged match posts.
 */
export async function generateWeekMatches(
  t: Document,
  actorId: string,
  requestedWeek?: number
): Promise<
  | { ok: true; weekNumber: number; matchesCreated: number; message: string }
  | { ok: false; error: string; status: number }
> {
  const tid = t._id as ObjectId;
  const guildId = String(t.guildId || "");
  const format = String(t.format || "single_elimination");

  if (!["registration_closed", "matchmaking", "in_progress"].includes(String(t.status))) {
    return {
      ok: false,
      error: "Close registration first before generating matchmaking.",
      status: 400,
    };
  }
  if (format === "custom") {
    return {
      ok: false,
      error: "Custom format uses manual match creation instead of automatic matchmaking.",
      status: 400,
    };
  }

  const { registrations, teams, matches, tournaments } = await getCollections();

  // Determine next week number
  const existingWeeks = Array.isArray(t.weeks)
    ? (t.weeks as Document[]).map((w) => Number(w.weekNumber ?? 0))
    : [];
  const latestMatch = await matches
    .find({ tournamentId: tid })
    .sort({ weekNumber: -1, matchNumber: -1 })
    .limit(1)
    .next();
  const maxWeek = Math.max(0, ...existingWeeks, Number(latestMatch?.weekNumber ?? 0));
  const targetWeek = requestedWeek && requestedWeek >= 1 ? requestedWeek : maxWeek + 1;

  const existingInWeek = await matches.countDocuments({
    tournamentId: tid,
    weekNumber: targetWeek,
  });
  if (existingInWeek > 0) {
    return {
      ok: false,
      error: `Week ${targetWeek} already has ${existingInWeek} match(es). Generate Week ${targetWeek + 1} instead.`,
      status: 400,
    };
  }

  const regDocs = await registrations
    .find({
      tournamentId: tid,
      status: "registered",
      squadPowerStatus: "approved",
    })
    .sort({ verifiedSquadPower: 1 })
    .toArray();

  const regByUser = new Map(regDocs.map((r) => [String(r.userId), r]));
  const sides: Entrant[] = [];

  if (t.mode === "team") {
    const teamDocs = await teams
      .find({ tournamentId: tid, status: "active" })
      .toArray();
    const minSize = t.allowIncompleteTeams ? 1 : Number(t.teamSizeMin ?? 2);
    const maxSize = Number(t.teamSizeMax ?? 5);

    for (const tm of teamDocs) {
      const mIds = Array.isArray(tm.memberIds) ? tm.memberIds.map(String) : [];
      if (mIds.length < minSize || mIds.length > maxSize) continue;
      const memberRegs = mIds.map((uid) => regByUser.get(uid));
      if (memberRegs.some((r) => !r || typeof r.verifiedSquadPower !== "number")) {
        continue;
      }
      const powers = memberRegs.map((r) => Number(r!.verifiedSquadPower));
      const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length;
      let teamPower = avgPower;
      let eligible = true;
      let assignedBracket: Document | null = null;

      if (t.teamPowerRule === "captain") {
        const cap = regByUser.get(String(tm.captainId));
        teamPower = typeof cap?.verifiedSquadPower === "number" ? cap.verifiedSquadPower : avgPower;
      }

      if (t.bracketsEnabled) {
        if (t.teamPowerRule === "all_members") {
          const mBrackets = powers.map((p) => findBracketForPower(t, p));
          const uniqueIds = new Set(mBrackets.filter(Boolean).map((b) => String(b!._id)));
          eligible = mBrackets.every(Boolean) && uniqueIds.size === 1;
          assignedBracket = eligible ? mBrackets[0] : null;
        } else {
          assignedBracket = findBracketForPower(t, teamPower);
          eligible = Boolean(assignedBracket);
        }
      }

      if (eligible) {
        if (assignedBracket) {
          await teams.updateOne(
            { _id: tm._id },
            { $set: { bracketId: assignedBracket._id, bracketAssignedAt: new Date() } }
          );
        }
        sides.push({
          ids: mIds,
          teamId: tm._id as ObjectId,
          label: String(tm.name || "Team"),
          power: teamPower,
          wins: 0,
          bracketId: assignedBracket ? (assignedBracket._id as ObjectId) : null,
        });
      }
    }
  } else {
    for (const r of regDocs) {
      if (typeof r.verifiedSquadPower !== "number") continue;
      const b = resolveRegBracket(t, r);
      if (t.bracketsEnabled && !b) continue;
      const label =
        String(r.inGameId || r.discordDisplayName || r.discordUsername || "").trim() ||
        `Player #${String(r.userId).slice(-4)}`;
      sides.push({
        ids: [String(r.userId)],
        teamId: null,
        label,
        power: Number(r.verifiedSquadPower),
        wins: Number(r.wins ?? 0),
        bracketId: b ? (b._id as ObjectId) : null,
      });
    }
  }

  if (sides.length < 2) {
    const pendingCount = await registrations.countDocuments({
      tournamentId: tid,
      status: "registered",
      squadPowerStatus: "pending",
    });
    const hint =
      pendingCount > 0
        ? ` You currently have ${pendingCount} pending Squad Power submission(s) waiting for approval in Players & Power.`
        : "";
    return {
      ok: false,
      error: `At least 2 eligible ${t.mode === "team" ? "teams" : "players"} with approved Squad Power are required (found ${sides.length}).${hint}`,
      status: 400,
    };
  }

  // Track previous opponents for Week 2+ rematch avoidance
  const pastOpponents = new Map<string, Set<string>>();
  if (targetWeek > 1) {
    const prevMatches = await matches
      .find({ tournamentId: tid }, { projection: { sideAUserIds: 1, sideBUserIds: 1, sideATeamId: 1, sideBTeamId: 1 } })
      .toArray();
    for (const pm of prevMatches) {
      const ka = entrantKey(
        Array.isArray(pm.sideAUserIds) ? pm.sideAUserIds.map(String) : [],
        (pm.sideATeamId as ObjectId) || null
      );
      const kb = entrantKey(
        Array.isArray(pm.sideBUserIds) ? pm.sideBUserIds.map(String) : [],
        (pm.sideBTeamId as ObjectId) || null
      );
      if (ka !== "BYE" && kb !== "BYE") {
        if (!pastOpponents.has(ka)) pastOpponents.set(ka, new Set());
        if (!pastOpponents.has(kb)) pastOpponents.set(kb, new Set());
        pastOpponents.get(ka)!.add(kb);
        pastOpponents.get(kb)!.add(ka);
      }
    }
    sides.sort((a, b) => b.wins - a.wins || a.power - b.power);
  } else {
    sides.sort((a, b) => a.power - b.power);
  }

  // Group entrants by bracket if enabled
  const groups: Entrant[][] = [];
  if (t.bracketsEnabled) {
    const byBracket = new Map<string, Entrant[]>();
    for (const s of sides) {
      if (!s.bracketId) continue;
      const k = String(s.bracketId);
      const arr = byBracket.get(k) || [];
      arr.push(s);
      byBracket.set(k, arr);
    }
    for (const arr of byBracket.values()) {
      if (arr.length >= 2) groups.push(arr);
    }
    if (groups.length === 0) {
      return {
        ok: false,
        error: "No bracket has at least 2 approved entrants yet.",
        status: 400,
      };
    }
  } else {
    groups.push(sides);
  }

  const lastNumDoc = await matches
    .find({ tournamentId: tid })
    .sort({ matchNumber: -1 })
    .limit(1)
    .next();
  let matchNo = Number(lastNumDoc?.matchNumber ?? 0) + 1;
  let weekMatchNo = 1;

  const mapPool =
    Array.isArray(t.maps) && t.maps.length > 0
      ? t.maps.map(String)
      : ["To be announced"];
  const now = new Date();
  const docsToInsert: Array<Record<string, unknown>> = [];
  const byeWinners: string[] = [];

  const pushPairing = (
    a: Entrant,
    b: Entrant | null,
    roundNo: number,
    seriesIndex: number | null,
    seriesId: string | null,
    seriesBestOf: number | null
  ) => {
    const mapName = mapPool[(weekMatchNo - 1) % mapPool.length];
    if (!b) {
      docsToInsert.push({
        guildId,
        tournamentId: tid,
        matchNumber: matchNo,
        weekMatchNumber: weekMatchNo,
        weekNumber: targetWeek,
        roundNumber: roundNo,
        bracketId: a.bracketId,
        sideAUserIds: a.ids,
        sideBUserIds: [],
        sideATeamId: a.teamId,
        sideBTeamId: null,
        sideALabel: a.label,
        sideBLabel: "BYE",
        sideAPower: a.power,
        sideBPower: 0,
        mapName,
        format,
        status: "approved",
        forumTag: "declared",
        isBye: true,
        reportedWinnerSide: "A",
        reportedWinnerLabel: a.label,
        approvedWinnerUserId: a.ids[0] || null,
        approvedWinnerTeamId: a.teamId,
        reviewedAt: now,
        reviewNote: "Automatic bye",
        seriesIndex,
        seriesId,
        seriesBestOf,
        createdAt: now,
      });
      byeWinners.push(...a.ids);
    } else {
      docsToInsert.push({
        guildId,
        tournamentId: tid,
        matchNumber: matchNo,
        weekMatchNumber: weekMatchNo,
        weekNumber: targetWeek,
        roundNumber: roundNo,
        bracketId: a.bracketId,
        sideAUserIds: a.ids,
        sideBUserIds: b.ids,
        sideATeamId: a.teamId,
        sideBTeamId: b.teamId,
        sideALabel: a.label,
        sideBLabel: b.label,
        sideAPower: a.power,
        sideBPower: b.power,
        mapName,
        format,
        status: "scheduled",
        forumTag: "pending",
        isBye: false,
        seriesIndex,
        seriesId,
        seriesBestOf,
        createdAt: now,
      });
    }
    matchNo += 1;
    weekMatchNo += 1;
  };

  for (const group of groups) {
    if (format === "round_robin" && targetWeek === 1) {
      const rotation: Array<Entrant | null> =
        group.length % 2 === 1 ? [...group, null] : [...group];
      const totalRounds = Math.max(1, rotation.length - 1);
      const half = rotation.length / 2;
      for (let r = 0; r < totalRounds; r++) {
        for (let i = 0; i < half; i++) {
          const left = rotation[i];
          const right = rotation[rotation.length - 1 - i];
          if (!left && !right) continue;
          if (!left || !right) {
            pushPairing((left || right)!, null, r + 1, null, null, null);
          } else {
            pushPairing(left, right, r + 1, null, null, null);
          }
        }
        const fixed = rotation[0];
        const last = rotation.pop()!;
        rotation.splice(1, 0, last);
        rotation[0] = fixed;
      }
      continue;
    }

    const pool = [...group];
    while (pool.length > 0) {
      const a = pool.shift()!;
      const aKey = entrantKey(a.ids, a.teamId);
      let b: Entrant | null = null;
      if (pool.length > 0) {
        const idx = pool.findIndex(
          (cand) => !pastOpponents.get(aKey)?.has(entrantKey(cand.ids, cand.teamId))
        );
        b = pool.splice(idx >= 0 ? idx : 0, 1)[0];
      }
      const bestOf =
        format === "series" && b ? Number(t.seriesBestOf ?? 3) : null;
      const seriesId =
        bestOf && bestOf > 1 ? `${String(tid)}:w${targetWeek}:series:${matchNo}` : null;
      pushPairing(a, b, targetWeek, seriesId ? 1 : null, seriesId, bestOf);
    }
  }

  if (docsToInsert.length === 0) {
    return {
      ok: false,
      error: "No match pairings could be generated.",
      status: 400,
    };
  }

  await matches.insertMany(docsToInsert);

  for (const uid of byeWinners) {
    await registrations.updateOne(
      { tournamentId: tid, userId: uid },
      { $inc: { wins: 1, points: 3 } }
    );
  }

  // Ensure Week entry exists in tournament.weeks
  const weekExists = existingWeeks.includes(targetWeek);
  const tourneyUpdate: Record<string, unknown> = {
    $set: {
      status: "in_progress",
      settingsLocked: true,
      teamsLocked: true,
      startedAt: t.startedAt || now,
      updatedAt: now,
    },
  };
  if (!weekExists) {
    tourneyUpdate.$push = {
      weeks: {
        weekNumber: targetWeek,
        status: "open",
        forumChannelId: null,
        forumUrl: null,
        announcementThreadId: null,
        announcementThreadUrl: null,
        isForum: true,
        tagIds: {},
        createdAt: now,
      },
    };
  }
  await tournaments.updateOne({ _id: tid }, tourneyUpdate as never);

  await writeAuditLog({
    guildId,
    actorId,
    action: "matchmaking.web_generate",
    targetType: "Tournament",
    targetId: String(tid),
    details: {
      weekNumber: targetWeek,
      matchesCreated: docsToInsert.length,
      format,
    },
  });

  return {
    ok: true,
    weekNumber: targetWeek,
    matchesCreated: docsToInsert.length,
    message: `Week ${targetWeek} created with ${docsToInsert.length} match(es)! SSE Tournament Bot is creating the Week ${targetWeek} Forum & match posts in Discord (~15s).`,
  };
}

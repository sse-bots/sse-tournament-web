import { ObjectId, Document } from "mongodb";
import { getCollections, writeAudit } from "./mongo";

export function parsePowerAverage(valuesText: string): { values: number[]; average: number } {
  const parts = valuesText
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new Error("Enter one or more non-negative squad-power values separated by commas.");
  }
  const values = parts.map((p) => Number(p));
  if (values.some((v) => Number.isNaN(v) || !Number.isFinite(v) || v < 0)) {
    throw new Error("Squad-power values must be non-negative numbers.");
  }
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  return { values, average };
}

export function bracketRangesOverlap(
  aMin: number,
  aMax: number | null,
  bMin: number,
  bMax: number | null
): boolean {
  const aHi = aMax === null ? Number.POSITIVE_INFINITY : aMax;
  const bHi = bMax === null ? Number.POSITIVE_INFINITY : bMax;
  return aMin <= bHi && bMin <= aHi;
}

export function bracketForPower(tournament: Document, power: number): Document | null {
  if (!tournament.bracketsEnabled) return null;
  const list: Document[] = Array.isArray(tournament.brackets) ? tournament.brackets : [];
  for (const b of list) {
    const min = Number(b.minPower);
    const max = b.maxPower === null || b.maxPower === undefined ? null : Number(b.maxPower);
    if (power >= min && (max === null || power <= max)) {
      return b;
    }
  }
  return null;
}

export function bracketForRegistration(tournament: Document, reg: Document): Document | null {
  const list: Document[] = Array.isArray(tournament.brackets) ? tournament.brackets : [];
  if (reg.bracketOverride && reg.bracketId) {
    const target = String(reg.bracketId);
    return list.find((b) => String(b._id) === target) || null;
  }
  if (reg.verifiedSquadPower !== null && reg.verifiedSquadPower !== undefined) {
    return bracketForPower(tournament, Number(reg.verifiedSquadPower));
  }
  return null;
}

export async function teamVerifiedPower(tournament: Document, team: Document): Promise<number> {
  const { registrations } = await getCollections();
  const memberIds: string[] = Array.isArray(team.memberIds) ? team.memberIds : [];
  const rows = await registrations
    .find({
      tournamentId: tournament._id,
      userId: { $in: memberIds },
      status: "registered",
      squadPowerStatus: "approved",
    })
    .toArray();
  const values = rows
    .filter((r) => r.verifiedSquadPower !== null && r.verifiedSquadPower !== undefined)
    .map((r) => Number(r.verifiedSquadPower));
  if (!values.length) return 0;
  if (tournament.teamPowerRule === "captain") {
    const cap = rows.find((r) => String(r.userId) === String(team.captainId));
    if (cap && cap.verifiedSquadPower !== undefined && cap.verifiedSquadPower !== null) {
      return Number(cap.verifiedSquadPower);
    }
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export async function teamRecordStats(
  tournament: Document,
  team: Document,
  bracketId?: ObjectId | null
) {
  const { matches, seriesRecords } = await getCollections();
  let wins = 0;
  let losses = 0;
  let points = 0;
  let played = 0;
  const teamIdStr = String(team._id);

  if (tournament.format === "series") {
    const srs = await seriesRecords
      .find({ tournamentId: tournament._id, status: "approved" })
      .toArray();
    for (const sr of srs) {
      const first = await matches.findOne({ seriesId: sr.seriesId });
      if (!first) continue;
      if (bracketId && String(first.bracketId) !== String(bracketId)) continue;
      const side =
        String(first.sideATeamId) === teamIdStr
          ? "A"
          : String(first.sideBTeamId) === teamIdStr
            ? "B"
            : null;
      if (!side) continue;
      played += 1;
      if (sr.winnerSide === side) {
        wins += 1;
        points += 3;
      } else {
        losses += 1;
      }
    }
    return { wins, losses, points, played, pct: wins / Math.max(1, played) };
  }

  const query: Record<string, unknown> = {
    tournamentId: tournament._id,
    status: { $in: ["approved", "forfeited"] },
  };
  if (bracketId) query.bracketId = bracketId;

  const docs = await matches.find(query).toArray();
  for (const md of docs) {
    const side =
      String(md.sideATeamId) === teamIdStr
        ? "A"
        : String(md.sideBTeamId) === teamIdStr
          ? "B"
          : null;
    if (!side) continue;
    played += 1;
    if (md.reportedWinnerSide === "DRAW") {
      points += 1;
    } else if (md.reportedWinnerSide === side) {
      wins += 1;
      points += 3;
    } else {
      losses += 1;
    }
  }
  return { wins, losses, points, played, pct: wins / Math.max(1, played) };
}

export async function rankRegistrationRows(tournament: Document, rows: Document[]) {
  const { matches } = await getCollections();
  const h2h = new Map<string, number>();
  const finalized = await matches
    .find({
      tournamentId: tournament._id,
      status: { $in: ["approved", "forfeited"] },
    })
    .toArray();

  for (const m of finalized) {
    const side = m.reportedWinnerSide;
    if (side !== "A" && side !== "B") continue;
    const winners: string[] = m[`side${side}UserIds`] || [];
    const losers: string[] = m[`side${side === "A" ? "B" : "A"}UserIds`] || [];
    for (const w of winners) {
      for (const l of losers) {
        const key = `${w}::${l}`;
        h2h.set(key, (h2h.get(key) || 0) + 1);
      }
    }
  }

  const primaryScore = (r: Document): number => {
    const w = Number(r.wins || 0);
    const l = Number(r.losses || 0);
    const pts = Number(r.points || 0);
    const pwr = Number(r.verifiedSquadPower || 0);
    if (tournament.scoring === "power") return pwr;
    if (tournament.scoring === "points") return pts;
    if (tournament.scoring === "combined") {
      return (
        w * Number(tournament.winWeight ?? 3) +
        pwr * Number(tournament.powerWeight ?? 0) +
        pts * Number(tournament.pointsWeight ?? 1)
      );
    }
    if (tournament.scoring === "win_percentage") return w / Math.max(1, w + l);
    return w;
  };

  const tieBreakers: string[] = Array.isArray(tournament.tieBreakers)
    ? tournament.tieBreakers
    : ["wins", "head_to_head", "points"];

  const scoreVector = (r: Document): number[] => {
    const w = Number(r.wins || 0);
    const l = Number(r.losses || 0);
    const pts = Number(r.points || 0);
    const pwr = Number(r.verifiedSquadPower || 0);
    const pct = w / Math.max(1, w + l);
    const prim = primaryScore(r);
    const tiedOthers = rows
      .filter((x) => x.userId !== r.userId && primaryScore(x) === prim)
      .map((x) => String(x.userId));
    const hh = tiedOthers.reduce((acc, other) => acc + (h2h.get(`${r.userId}::${other}`) || 0), 0);
    const metrics: Record<string, number> = {
      wins: w,
      head_to_head: hh,
      points: pts,
      win_percentage: pct,
      power: pwr,
    };
    const ties = tieBreakers.filter((k) => k in metrics).map((k) => metrics[k]);
    return [prim, ...ties];
  };

  return [...rows].sort((a, b) => {
    const va = scoreVector(a);
    const vb = scoreVector(b);
    for (let i = 0; i < Math.max(va.length, vb.length); i++) {
      const diff = (vb[i] || 0) - (va[i] || 0);
      if (diff !== 0) return diff;
    }
    return String(b.userId || "").localeCompare(String(a.userId || ""));
  });
}

export async function applyResultScore(
  tournament: Document,
  matchDoc: Document,
  winnerSide: "A" | "B" | "DRAW"
): Promise<boolean> {
  const { registrations, matches, seriesRecords } = await getCollections();
  const sideA: string[] = matchDoc.sideAUserIds || [];
  const sideB: string[] = matchDoc.sideBUserIds || [];

  if (winnerSide === "DRAW") {
    for (const uid of [...sideA, ...sideB]) {
      await registrations.updateOne(
        { tournamentId: tournament._id, userId: uid },
        { $inc: { points: 1 } }
      );
    }
    return true;
  }

  if (tournament.format === "series" && matchDoc.seriesId) {
    const seriesId = String(matchDoc.seriesId);
    const sMatches = await matches
      .find({ seriesId, status: { $in: ["approved", "forfeited"] } })
      .toArray();
    const wins = { A: 0, B: 0 };
    for (const item of sMatches) {
      if (item.reportedWinnerSide === "A") wins.A += 1;
      if (item.reportedWinnerSide === "B") wins.B += 1;
    }
    const bestOf = Number(matchDoc.seriesBestOf || tournament.seriesBestOf || 3);
    const needed = Math.floor(bestOf / 2) + 1;
    const clinched = wins.A >= needed ? "A" : wins.B >= needed ? "B" : null;
    if (!clinched) return false;

    const existing = await seriesRecords.findOne({ seriesId });
    if (existing) return false;

    await seriesRecords.insertOne({
      seriesId,
      tournamentId: tournament._id,
      winnerSide: clinched,
      status: "approved",
      wins,
      createdAt: new Date(),
    });
    const first = sMatches[0] || matchDoc;
    const wIds: string[] = first[`side${clinched}UserIds`] || [];
    const lIds: string[] = first[`side${clinched === "A" ? "B" : "A"}UserIds`] || [];
    for (const uid of wIds) {
      await registrations.updateOne(
        { tournamentId: tournament._id, userId: uid },
        { $inc: { wins: 1, points: 3 } }
      );
    }
    for (const uid of lIds) {
      await registrations.updateOne(
        { tournamentId: tournament._id, userId: uid },
        { $inc: { losses: 1 } }
      );
    }
    await matches.updateMany(
      { seriesId, status: { $in: ["scheduled", "ready", "postponed"] } },
      { $set: { status: "cancelled", seriesEndedEarly: true, seriesWinnerSide: clinched } }
    );
    await matches.updateMany({ seriesId }, { $set: { seriesWinnerSide: clinched } });
    return true;
  }

  const wIds = winnerSide === "A" ? sideA : sideB;
  const lIds = winnerSide === "A" ? sideB : sideA;
  for (const uid of wIds) {
    await registrations.updateOne(
      { tournamentId: tournament._id, userId: uid },
      { $inc: { wins: 1, points: 3 } }
    );
  }
  for (const uid of lIds) {
    await registrations.updateOne(
      { tournamentId: tournament._id, userId: uid },
      { $inc: { losses: 1 } }
    );
  }
  return true;
}

export async function reverseSingleMatchScore(tournament: Document, matchDoc: Document) {
  const { registrations } = await getCollections();
  const oldSide = matchDoc.reportedWinnerSide;
  const sideA: string[] = matchDoc.sideAUserIds || [];
  const sideB: string[] = matchDoc.sideBUserIds || [];
  if (oldSide === "DRAW") {
    for (const uid of [...sideA, ...sideB]) {
      await registrations.updateOne(
        { tournamentId: tournament._id, userId: uid },
        { $inc: { points: -1 } }
      );
    }
  } else if (oldSide === "A" || oldSide === "B") {
    const wIds = oldSide === "A" ? sideA : sideB;
    const lIds = oldSide === "A" ? sideB : sideA;
    for (const uid of wIds) {
      await registrations.updateOne(
        { tournamentId: tournament._id, userId: uid },
        { $inc: { wins: -1, points: -3 } }
      );
    }
    for (const uid of lIds) {
      await registrations.updateOne(
        { tournamentId: tournament._id, userId: uid },
        { $inc: { losses: -1 } }
      );
    }
  }
}

export interface EntrantSeed {
  ids: string[];
  teamId: ObjectId | null;
  name?: string;
  power: number;
  bracketId: ObjectId | null;
}

export async function buildEligibleEntrants(tournament: Document): Promise<EntrantSeed[]> {
  const { registrations, teams } = await getCollections();
  const regs = await registrations
    .find({
      tournamentId: tournament._id,
      status: "registered",
      squadPowerStatus: "approved",
    })
    .sort({ verifiedSquadPower: 1 })
    .toArray();

  const sides: EntrantSeed[] = [];

  if (tournament.mode === "team") {
    const activeTeams = await teams
      .find({ tournamentId: tournament._id, status: "active" })
      .toArray();
    for (const tm of activeTeams) {
      const members: string[] = tm.memberIds || [];
      const minAllowed = tournament.allowIncompleteTeams ? 1 : Number(tournament.teamSizeMin || 2);
      const maxAllowed = Number(tournament.teamSizeMax || 5);
      if (members.length < minAllowed || members.length > maxAllowed) continue;

      const memberRegs = members.map((uid) => regs.find((r) => String(r.userId) === String(uid)));
      if (memberRegs.some((r) => !r || r.verifiedSquadPower === null || r.verifiedSquadPower === undefined)) {
        continue;
      }
      const powers = memberRegs.map((r) => Number(r!.verifiedSquadPower));
      let teamPower = powers.reduce((a, b) => a + b, 0) / powers.length;
      let eligible = true;

      if (tournament.teamPowerRule === "all_members") {
        if (tournament.bracketsEnabled) {
          const mb = powers.map((p) => bracketForPower(tournament, p));
          eligible = mb.every(Boolean) && new Set(mb.map((x) => String(x!._id))).size === 1;
        }
      } else if (tournament.teamPowerRule === "captain") {
        const cap = memberRegs.find((r) => String(r!.userId) === String(tm.captainId));
        if (cap) teamPower = Number(cap.verifiedSquadPower);
        if (tournament.bracketsEnabled) {
          eligible = Boolean(bracketForPower(tournament, teamPower));
        }
      } else if (tournament.bracketsEnabled) {
        eligible = Boolean(bracketForPower(tournament, teamPower));
      }
      if (!eligible) continue;
      const b = tournament.bracketsEnabled ? bracketForPower(tournament, teamPower) : null;
      sides.push({
        ids: members,
        teamId: tm._id as ObjectId,
        name: String(tm.name),
        power: teamPower,
        bracketId: b ? (b._id as ObjectId) : null,
      });
    }
  } else {
    for (const r of regs) {
      const b = tournament.bracketsEnabled ? bracketForRegistration(tournament, r) : null;
      if (tournament.bracketsEnabled && !b) continue;
      sides.push({
        ids: [String(r.userId)],
        teamId: null,
        name: r.inGameId ? `${r.inGameId} (${r.userId})` : String(r.userId),
        power: Number(r.verifiedSquadPower || 0),
        bracketId: b ? (b._id as ObjectId) : null,
      });
    }
  }

  sides.sort((a, b) => a.power - b.power);
  return sides;
}

export async function createMatchRecord(
  tournament: Document,
  a: EntrantSeed,
  b: EntrantSeed,
  matchNumber: number,
  roundNumber: number,
  bracketId: ObjectId | null,
  seriesMeta?: { seriesId: string; seriesIndex: number; seriesBestOf: number }
) {
  const { matches, registrations } = await getCollections();
  const existing = await matches.findOne({ tournamentId: tournament._id, matchNumber });
  if (existing) return existing;

  const maps: string[] =
    Array.isArray(tournament.maps) && tournament.maps.length > 0
      ? tournament.maps
      : ["To be announced"];

  const doc: Record<string, unknown> = {
    guildId: String(tournament.guildId),
    tournamentId: tournament._id,
    matchNumber,
    bracketId: bracketId || null,
    sideAUserIds: [...a.ids],
    sideBUserIds: [...b.ids],
    sideATeamId: a.teamId || null,
    sideBTeamId: b.teamId || null,
    sideAPower: Number(a.power || 0),
    sideBPower: Number(b.power || 0),
    mapName: maps[(matchNumber - 1) % maps.length],
    format: tournament.format,
    roundNumber,
    status: "scheduled",
    createdAt: new Date(),
    seriesIndex: seriesMeta ? seriesMeta.seriesIndex : null,
  };

  if (seriesMeta) {
    doc.seriesId = seriesMeta.seriesId;
    doc.seriesBestOf = seriesMeta.seriesBestOf;
  }

  if (b.ids.length === 0) {
    doc.status = "approved";
    doc.isBye = true;
    doc.reportedWinnerSide = "A";
    doc.approvedWinnerUserId = a.ids[0] || null;
    doc.approvedWinnerTeamId = a.teamId || null;
    doc.reviewedAt = new Date();
    doc.reviewNote = "Automatic bye";
    const res = await matches.insertOne(doc);
    doc._id = res.insertedId;
    for (const uid of a.ids) {
      await registrations.updateOne(
        { tournamentId: tournament._id, userId: uid },
        { $inc: { wins: 1, points: 3 } }
      );
    }
    return doc;
  }

  const res = await matches.insertOne(doc);
  doc._id = res.insertedId;
  return doc;
}

export async function advanceSeriesIfNeeded(tournament: Document, matchDoc: Document) {
  const seriesId = matchDoc.seriesId;
  if (tournament.format !== "series" || !seriesId) return;
  const { seriesRecords, matches } = await getCollections();
  if (await seriesRecords.findOne({ seriesId })) return;

  const seriesMatches = await matches.find({ seriesId }).sort({ seriesIndex: 1 }).toArray();
  const completed = seriesMatches.filter(
    (x) =>
      (x.status === "approved" || x.status === "forfeited") &&
      (x.reportedWinnerSide === "A" || x.reportedWinnerSide === "B")
  );
  const bestOf = Number(matchDoc.seriesBestOf || tournament.seriesBestOf || 3);
  const wins = { A: 0, B: 0 };
  for (const item of completed) {
    if (item.reportedWinnerSide === "A") wins.A += 1;
    if (item.reportedWinnerSide === "B") wins.B += 1;
  }
  const needed = Math.floor(bestOf / 2) + 1;
  if (wins.A >= needed || wins.B >= needed) return;

  const hasOpen = seriesMatches.some((x) =>
    ["scheduled", "ready", "in_progress", "pending_review", "pending_proof", "disputed"].includes(
      String(x.status)
    )
  );
  if (hasOpen) return;

  const maxIdx = Math.max(0, ...seriesMatches.map((x) => Number(x.seriesIndex || 0)));
  const nextIndex = maxIdx + 1;
  if (nextIndex > bestOf) return;

  const lastDoc = await matches
    .find({ tournamentId: tournament._id })
    .sort({ matchNumber: -1 })
    .limit(1)
    .toArray();
  const nextNo = (lastDoc[0]?.matchNumber || 0) + 1;

  await createMatchRecord(
    tournament,
    {
      ids: matchDoc.sideAUserIds || [],
      teamId: matchDoc.sideATeamId || null,
      power: Number(matchDoc.sideAPower || 0),
      bracketId: matchDoc.bracketId || null,
    },
    {
      ids: matchDoc.sideBUserIds || [],
      teamId: matchDoc.sideBTeamId || null,
      power: Number(matchDoc.sideBPower || 0),
      bracketId: matchDoc.bracketId || null,
    },
    nextNo,
    Number(matchDoc.roundNumber || 1),
    matchDoc.bracketId || null,
    { seriesId: String(seriesId), seriesIndex: nextIndex, seriesBestOf: bestOf }
  );
}

function entrantKey(ids: string[], teamId: ObjectId | null): string {
  if (teamId) return `T:${teamId.toHexString()}`;
  return ids.length ? `U:${ids[0]}` : "BYE";
}

export async function advanceTournamentIfReady(tournament: Document, roundNo: number) {
  const fmt = String(tournament.format);
  if (!["single_elimination", "double_elimination", "swiss"].includes(fmt)) return 0;

  const { matches, tournaments } = await getCollections();
  const roundDocsAll = await matches
    .find({ tournamentId: tournament._id, roundNumber: roundNo })
    .sort({ matchNumber: 1 })
    .toArray();

  const bracketKeys = new Map<string, ObjectId | null>();
  for (const m of roundDocsAll) {
    const bId = m.bracketId ? (m.bracketId as ObjectId) : null;
    bracketKeys.set(bId ? bId.toHexString() : "none", bId);
  }

  let totalMade = 0;

  for (const [bKey, bracketId] of bracketKeys.entries()) {
    const roundDocs = roundDocsAll.filter((m) =>
      bracketId ? String(m.bracketId) === bracketId.toHexString() : !m.bracketId
    );
    if (!roundDocs.length) continue;
    if (roundDocs.some((m) => m.status !== "approved" && m.status !== "forfeited")) continue;
    if (roundDocs.some((m) => m.reportedWinnerSide === "DRAW")) continue;

    const roundKey = `${bKey}:${roundNo + 1}`;
    const guard = await tournaments.updateOne(
      { _id: tournament._id, generatedRoundKeys: { $ne: roundKey } },
      { $addToSet: { generatedRoundKeys: roundKey } }
    );
    if (!guard.modifiedCount) continue;

    const allBracketMatches = await matches
      .find({ tournamentId: tournament._id, bracketId: bracketId || null })
      .toArray();
    const entrants = new Map<string, EntrantSeed & { key: string }>();
    for (const m of allBracketMatches) {
      for (const side of ["A", "B"] as const) {
        const ids: string[] = m[`side${side}UserIds`] || [];
        const tid: ObjectId | null = m[`side${side}TeamId`] || null;
        if (!ids.length) continue;
        const k = entrantKey(ids, tid);
        entrants.set(k, {
          ids,
          teamId: tid,
          power: Number(m[`side${side}Power`] || 0),
          bracketId,
          key: k,
        });
      }
    }

    const wins = new Map<string, number>();
    const losses = new Map<string, number>();
    const scores = new Map<string, number>();
    const opponents = new Map<string, Set<string>>();

    for (const m of allBracketMatches) {
      if (m.status !== "approved" && m.status !== "forfeited") continue;
      const aIds: string[] = m.sideAUserIds || [];
      const bIds: string[] = m.sideBUserIds || [];
      const ka = entrantKey(aIds, m.sideATeamId || null);
      const kb = entrantKey(bIds, m.sideBTeamId || null);
      if (aIds.length && !bIds.length && m.isBye) {
        wins.set(ka, (wins.get(ka) || 0) + 1);
        scores.set(ka, (scores.get(ka) || 0) + 3);
        continue;
      }
      if (!aIds.length || !bIds.length) continue;
      if (!opponents.has(ka)) opponents.set(ka, new Set());
      if (!opponents.has(kb)) opponents.set(kb, new Set());
      opponents.get(ka)!.add(kb);
      opponents.get(kb)!.add(ka);

      if (m.reportedWinnerSide === "A") {
        wins.set(ka, (wins.get(ka) || 0) + 1);
        losses.set(kb, (losses.get(kb) || 0) + 1);
        scores.set(ka, (scores.get(ka) || 0) + 3);
      } else if (m.reportedWinnerSide === "B") {
        wins.set(kb, (wins.get(kb) || 0) + 1);
        losses.set(ka, (losses.get(ka) || 0) + 1);
        scores.set(kb, (scores.get(kb) || 0) + 3);
      }
    }

    let nextEntrants: Array<EntrantSeed & { key: string }> = [];

    if (fmt === "single_elimination") {
      for (const m of roundDocs) {
        const side = m.reportedWinnerSide === "B" ? "B" : "A";
        const ids: string[] = m[`side${side}UserIds`] || [];
        const tid: ObjectId | null = m[`side${side}TeamId`] || null;
        if (ids.length) {
          nextEntrants.push({
            ids,
            teamId: tid,
            power: Number(m[`side${side}Power`] || 0),
            bracketId,
            key: entrantKey(ids, tid),
          });
        }
      }
      if (nextEntrants.length <= 1) {
        if (nextEntrants[0]) {
          await tournaments.updateOne(
            { _id: tournament._id },
            {
              $set: {
                [`bracketChampions.${bKey}`]: nextEntrants[0].key,
                championDeclaredAt: new Date(),
              },
            }
          );
        }
        continue;
      }
    } else if (fmt === "double_elimination") {
      nextEntrants = Array.from(entrants.values()).filter((e) => (losses.get(e.key) || 0) < 2);
      if (nextEntrants.length <= 1) {
        if (nextEntrants[0]) {
          await tournaments.updateOne(
            { _id: tournament._id },
            {
              $set: {
                [`bracketChampions.${bKey}`]: nextEntrants[0].key,
                championDeclaredAt: new Date(),
              },
            }
          );
        }
        continue;
      }
      nextEntrants.sort(
        (a, b) =>
          (losses.get(a.key) || 0) - (losses.get(b.key) || 0) ||
          (wins.get(b.key) || 0) - (wins.get(a.key) || 0) ||
          a.key.localeCompare(b.key)
      );
    } else {
      const configured = Number(tournament.swissRounds || 0);
      const maxRounds =
        configured > 0 ? configured : Math.max(1, Math.ceil(Math.log2(Math.max(2, entrants.size))));
      if (roundNo >= maxRounds) continue;
      nextEntrants = Array.from(entrants.values()).sort(
        (a, b) =>
          (scores.get(b.key) || 0) - (scores.get(a.key) || 0) ||
          (wins.get(b.key) || 0) - (wins.get(a.key) || 0) ||
          a.key.localeCompare(b.key)
      );
    }

    const pool = [...nextEntrants];
    const pairs: Array<[EntrantSeed, EntrantSeed]> = [];
    while (pool.length) {
      const a = pool.shift()!;
      if (!pool.length) {
        pairs.push([a, { ids: [], teamId: null, power: 0, bracketId }]);
        break;
      }
      let idx = 0;
      if (fmt === "double_elimination" || fmt === "swiss") {
        const prev = opponents.get(a.key) || new Set();
        const found = pool.findIndex((x) => !prev.has(x.key));
        idx = found >= 0 ? found : 0;
      }
      const b = pool.splice(idx, 1)[0];
      pairs.push([a, b]);
    }

    const lastDoc = await matches
      .find({ tournamentId: tournament._id })
      .sort({ matchNumber: -1 })
      .limit(1)
      .toArray();
    let nextNo = (lastDoc[0]?.matchNumber || 0) + 1;

    for (const [a, b] of pairs) {
      await createMatchRecord(tournament, a, b, nextNo, roundNo + 1, bracketId);
      nextNo += 1;
      totalMade += 1;
    }

    await writeAudit(
      String(tournament.guildId),
      "system",
      "matchmaking.next_round",
      "Tournament",
      tournament._id as ObjectId,
      { round: roundNo + 1, matches: pairs.length, format: fmt }
    );
  }

  return totalMade;
}

import type { Document, ObjectId } from "mongodb";
import { getCollections, toIso } from "./mongodb";
import {
  fetchUserDiscordGuilds,
  hasManageGuildPermission,
  type StoredSession,
} from "./auth";
import type {
  AuditLogRow,
  FinalStandingRow,
  MatchRow,
  PowerBracket,
  RegistrationRow,
  SupportTicketRow,
  TeamPowerRule,
  TeamRow,
  TournamentFormat,
  TournamentMode,
  TournamentScoring,
  TournamentStatus,
  TournamentSummary,
} from "./tournament-types";

export function findBracketForPower(
  tournament: Document,
  power: number | null | undefined
): Document | null {
  if (!tournament.bracketsEnabled || power === null || power === undefined) {
    return null;
  }
  const brackets = Array.isArray(tournament.brackets)
    ? (tournament.brackets as Document[])
    : [];
  for (const b of brackets) {
    const minP = Number(b.minPower ?? 0);
    const maxP =
      b.maxPower === null || b.maxPower === undefined ? null : Number(b.maxPower);
    if (power >= minP && (maxP === null || power <= maxP)) {
      return b;
    }
  }
  return null;
}

export function bracketsOverlap(
  aMin: number,
  aMax: number | null,
  bMin: number,
  bMax: number | null
): boolean {
  const aHi = aMax === null ? Number.POSITIVE_INFINITY : aMax;
  const bHi = bMax === null ? Number.POSITIVE_INFINITY : bMax;
  return aMin <= bHi && bMin <= aHi;
}

export async function canManageGuildOrTournament(
  session: StoredSession | null,
  guildId: string,
  ownerId?: string | null
): Promise<boolean> {
  if (!session) return false;
  if (session.user.isGlobalAdmin) return true;
  if (ownerId && session.user.discordId && String(ownerId) === String(session.user.discordId)) {
    return true;
  }
  if (ownerId && String(ownerId) === String(session.user.sub)) {
    return true;
  }
  const guilds = await fetchUserDiscordGuilds(session.accessToken);
  const match = guilds.find((g) => String(g.id) === String(guildId));
  return Boolean(match && hasManageGuildPermission(match));
}

export function mapBrackets(raw: unknown): PowerBracket[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b: Document) => ({
      id: String(b._id || b.name),
      name: String(b.name || "Bracket"),
      minPower: Number(b.minPower ?? 0),
      maxPower:
        b.maxPower === null || b.maxPower === undefined
          ? null
          : Number(b.maxPower),
      displayOrder:
        typeof b.displayOrder === "number" ? b.displayOrder : undefined,
    }))
    .sort(
      (a, b) =>
        (a.displayOrder ?? 999) - (b.displayOrder ?? 999) ||
        a.minPower - b.minPower
    );
}

export async function hydrateTournamentSummary(
  doc: Document,
  gameNameMap?: Map<string, string>
): Promise<TournamentSummary> {
  const { games, registrations, teams, matches } = await getCollections();
  const tid = doc._id as ObjectId;

  let gameName = "Custom Game";
  const gidStr = doc.gameId ? String(doc.gameId) : "";
  if (gameNameMap && gidStr && gameNameMap.has(gidStr)) {
    gameName = gameNameMap.get(gidStr)!;
  } else if (doc.gameId) {
    const gDoc = await games.findOne({ _id: doc.gameId });
    if (gDoc?.name) gameName = String(gDoc.name);
  }

  const [
    regCount,
    pendingPowerCount,
    teamCount,
    matchCount,
    pendingReviewCount,
    disputedCount,
  ] = await Promise.all([
    registrations.countDocuments({ tournamentId: tid, status: "registered" }),
    registrations.countDocuments({
      tournamentId: tid,
      status: "registered",
      squadPowerStatus: "pending",
    }),
    teams.countDocuments({ tournamentId: tid, status: "active" }),
    matches.countDocuments({ tournamentId: tid }),
    matches.countDocuments({ tournamentId: tid, status: "pending_review" }),
    matches.countDocuments({ tournamentId: tid, status: "disputed" }),
  ]);

  const schedule = (doc.schedule || {}) as Record<string, unknown>;
  const policy = (doc.resultPolicy || {}) as Record<string, unknown>;
  const prizes = (doc.prizeDescriptions || {}) as Record<string, unknown>;

  return {
    id: String(tid),
    guildId: String(doc.guildId || ""),
    name: String(doc.name || "Untitled Tournament"),
    gameId: gidStr,
    gameName,
    description: String(doc.description || ""),
    ownerId: String(doc.ownerId || ""),
    status: (doc.status || "draft") as TournamentStatus,
    format: (doc.format || "single_elimination") as TournamentFormat,
    mode: (doc.mode || "individual") as TournamentMode,
    scoring: (doc.scoring || "wins") as TournamentScoring,
    bracketsEnabled: Boolean(doc.bracketsEnabled),
    brackets: mapBrackets(doc.brackets),
    teamSizeMin: Number(doc.teamSizeMin ?? 1),
    teamSizeMax: Number(doc.teamSizeMax ?? 1),
    teamPowerRule: (doc.teamPowerRule || "average") as TeamPowerRule,
    maps: Array.isArray(doc.maps) ? doc.maps.map(String) : [],
    schedule: {
      startAt: toIso(schedule.startAt),
      endAt: toIso(schedule.endAt),
      matchDeadlineHours:
        typeof schedule.matchDeadlineHours === "number"
          ? schedule.matchDeadlineHours
          : 48,
      matchDurationMinutes:
        typeof schedule.matchDurationMinutes === "number"
          ? schedule.matchDurationMinutes
          : 60,
    },
    resultPolicy: {
      proofRequired: policy.proofRequired !== false,
      approvalRequired: policy.approvalRequired !== false,
      allowDraws: Boolean(policy.allowDraws),
    },
    tieBreakers: Array.isArray(doc.tieBreakers)
      ? doc.tieBreakers.map(String)
      : ["wins", "head_to_head", "points"],
    swissRounds: Number(doc.swissRounds ?? 0),
    seriesBestOf: Number(doc.seriesBestOf ?? 3),
    allowMultipleTeams: Boolean(doc.allowMultipleTeams),
    allowIncompleteTeams: Boolean(doc.allowIncompleteTeams),
    teamInvitesOnly: Boolean(doc.teamInvitesOnly),
    leaderboardUpdateHours: Number(doc.leaderboardUpdateHours ?? 0),
    prizeDescriptions: {
      first: typeof prizes.first === "string" ? prizes.first : undefined,
      second: typeof prizes.second === "string" ? prizes.second : undefined,
      third: typeof prizes.third === "string" ? prizes.third : undefined,
    },
    settingsLocked: Boolean(doc.settingsLocked),
    teamsLocked: Boolean(doc.teamsLocked),
    standingsFrozen: Boolean(doc.standingsFrozen),
    finalStandings: Array.isArray(doc.finalStandings)
      ? (doc.finalStandings as FinalStandingRow[])
      : [],
    counts: {
      registrations: regCount,
      pendingPower: pendingPowerCount,
      teams: teamCount,
      matches: matchCount,
      pendingReview: pendingReviewCount,
      disputed: disputedCount,
    },
    createdAt: toIso(doc.createdAt),
    startedAt: toIso(doc.startedAt),
    completedAt: toIso(doc.completedAt),
  };
}

export async function getFullTournamentDetail(
  tournamentDoc: Document,
  includeManagerData = false
) {
  const { registrations, teams, matches, tickets, auditLogs, seriesRecords } =
    await getCollections();
  const tid = tournamentDoc._id as ObjectId;

  const [
    summary,
    regDocs,
    teamDocs,
    matchDocs,
    seriesDocs,
    ticketDocs,
    auditDocs,
  ] = await Promise.all([
    hydrateTournamentSummary(tournamentDoc),
    registrations.find({ tournamentId: tid }).sort({ wins: -1, points: -1 }).toArray(),
    teams.find({ tournamentId: tid }).sort({ name: 1 }).toArray(),
    matches
      .find({ tournamentId: tid })
      .sort({ roundNumber: 1, matchNumber: 1 })
      .toArray(),
    seriesRecords.find({ tournamentId: tid }).toArray(),
    includeManagerData
      ? tickets.find({ tournamentId: tid }).sort({ createdAt: -1 }).limit(50).toArray()
      : Promise.resolve([]),
    includeManagerData
      ? auditLogs
          .find({
            guildId: String(tournamentDoc.guildId),
            $or: [{ targetId: String(tid) }, { targetType: { $in: ["Match", "Registration", "Team"] } }],
          })
          .sort({ createdAt: -1 })
          .limit(60)
          .toArray()
      : Promise.resolve([]),
  ]);

  const bracketNameMap = new Map(summary.brackets.map((b) => [b.id, b.name]));
  const teamNameMap = new Map(teamDocs.map((t) => [String(t._id), String(t.name)]));
  const regByUser = new Map(regDocs.map((r) => [String(r.userId), r]));

  const h2h = new Map<string, number>();
  for (const m of matchDocs) {
    if (!["approved", "forfeited"].includes(String(m.status))) continue;
    const side = m.reportedWinnerSide;
    if (side !== "A" && side !== "B") continue;
    const winners = (m[`side${side}UserIds`] || []) as string[];
    const losers = (m[`side${side === "A" ? "B" : "A"}UserIds`] || []) as string[];
    for (const w of winners) {
      for (const l of losers) {
        const key = `${w}:${l}`;
        h2h.set(key, (h2h.get(key) || 0) + 1);
      }
    }
  }

  const mappedRegs: RegistrationRow[] = regDocs.map((r) => {
    const wins = Number(r.wins ?? 0);
    const losses = Number(r.losses ?? 0);
    const played = wins + losses;
    const bId = r.bracketId ? String(r.bracketId) : null;
    const tId = r.teamId ? String(r.teamId) : null;
    return {
      id: String(r._id),
      userId: String(r.userId),
      inGameId: String(r.inGameId || ""),
      powerValues: Array.isArray(r.powerValues) ? r.powerValues.map(Number) : [],
      claimedSquadPower:
        typeof r.claimedSquadPower === "number" ? r.claimedSquadPower : null,
      verifiedSquadPower:
        typeof r.verifiedSquadPower === "number" ? r.verifiedSquadPower : null,
      squadPowerProofUrl:
        typeof r.squadPowerProofUrl === "string" ? r.squadPowerProofUrl : null,
      squadPowerStatus: String(r.squadPowerStatus || "pending"),
      bracketId: bId,
      bracketName: bId ? bracketNameMap.get(bId) || null : null,
      bracketOverride: Boolean(r.bracketOverride),
      teamId: tId,
      teamName: tId ? teamNameMap.get(tId) || null : null,
      status: String(r.status || "registered"),
      wins,
      losses,
      points: Number(r.points ?? 0),
      winRate: played > 0 ? Math.round((wins / played) * 1000) / 10 : 0,
      createdAt: toIso(r.createdAt),
    };
  });

  const winWeight = Number(tournamentDoc.winWeight ?? 3);
  const powerWeight = Number(tournamentDoc.powerWeight ?? 0);
  const pointsWeight = Number(tournamentDoc.pointsWeight ?? 1);
  const primaryScore = (r: RegistrationRow) => {
    if (summary.scoring === "power") return r.verifiedSquadPower ?? 0;
    if (summary.scoring === "points") return r.points;
    if (summary.scoring === "win_percentage") return r.winRate;
    if (summary.scoring === "combined") {
      return (
        r.wins * winWeight +
        (r.verifiedSquadPower ?? 0) * powerWeight +
        r.points * pointsWeight
      );
    }
    return r.wins;
  };

  mappedRegs.sort((a, b) => {
    if (a.status === "registered" && b.status !== "registered") return -1;
    if (b.status === "registered" && a.status !== "registered") return 1;
    const diff = primaryScore(b) - primaryScore(a);
    if (diff !== 0) return diff;
    const h2hDiff =
      (h2h.get(`${b.userId}:${a.userId}`) || 0) -
      (h2h.get(`${a.userId}:${b.userId}`) || 0);
    if (h2hDiff !== 0) return h2hDiff;
    if (b.points !== a.points) return b.points - a.points;
    return b.wins - a.wins;
  });

  const mappedTeams: TeamRow[] = teamDocs.map((tm) => {
    const teamIdStr = String(tm._id);
    const memberIds = Array.isArray(tm.memberIds) ? tm.memberIds.map(String) : [];
    const powers = memberIds
      .map((uid) => regByUser.get(uid)?.verifiedSquadPower)
      .filter((v): v is number => typeof v === "number");

    let verifiedPower = 0;
    if (powers.length > 0) {
      if (summary.teamPowerRule === "captain") {
        const capPower = regByUser.get(String(tm.captainId))?.verifiedSquadPower;
        verifiedPower =
          typeof capPower === "number"
            ? capPower
            : powers.reduce((s, v) => s + v, 0) / powers.length;
      } else {
        verifiedPower = powers.reduce((s, v) => s + v, 0) / powers.length;
      }
    }

    let wins = 0;
    let losses = 0;
    let points = 0;
    let played = 0;

    if (summary.format === "series") {
      for (const sr of seriesDocs) {
        if (sr.status !== "approved") continue;
        const first = matchDocs.find((m) => m.seriesId === sr.seriesId);
        if (!first) continue;
        const side =
          first.sideATeamId && String(first.sideATeamId) === teamIdStr
            ? "A"
            : first.sideBTeamId && String(first.sideBTeamId) === teamIdStr
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
    } else {
      for (const m of matchDocs) {
        if (!["approved", "forfeited"].includes(String(m.status))) continue;
        const side =
          m.sideATeamId && String(m.sideATeamId) === teamIdStr
            ? "A"
            : m.sideBTeamId && String(m.sideBTeamId) === teamIdStr
              ? "B"
              : null;
        if (!side) continue;
        played += 1;
        if (m.reportedWinnerSide === "DRAW") points += 1;
        else if (m.reportedWinnerSide === side) {
          wins += 1;
          points += 3;
        } else losses += 1;
      }
    }

    const bId = tm.bracketId ? String(tm.bracketId) : null;
    return {
      id: teamIdStr,
      name: String(tm.name || "Team"),
      captainId: String(tm.captainId || ""),
      memberIds,
      invitedIds: Array.isArray(tm.invitedIds) ? tm.invitedIds.map(String) : [],
      logoUrl: typeof tm.logoUrl === "string" ? tm.logoUrl : null,
      bracketId: bId,
      bracketName: bId ? bracketNameMap.get(bId) || null : null,
      status: String(tm.status || "active"),
      wins,
      losses,
      points,
      played,
      winRate: played > 0 ? Math.round((wins / played) * 1000) / 10 : 0,
      verifiedPower: Math.round(verifiedPower * 10) / 10,
      createdAt: toIso(tm.createdAt),
    };
  });

  mappedTeams.sort((a, b) => b.wins - a.wins || b.points - a.points);

  const formatSideLabel = (
    userIds: string[],
    teamId: string | null,
    isByeSide: boolean
  ) => {
    if (teamId && teamNameMap.has(teamId)) return teamNameMap.get(teamId)!;
    if (userIds.length === 0) return isByeSide ? "BYE" : "TBD";
    return userIds
      .map((uid) => {
        const reg = regByUser.get(uid);
        return reg?.inGameId ? `${reg.inGameId} (${uid.slice(-4)})` : `Player #${uid.slice(-4)}`;
      })
      .join(", ");
  };

  const mappedMatches: MatchRow[] = matchDocs.map((m) => {
    const sideAIds = Array.isArray(m.sideAUserIds) ? m.sideAUserIds.map(String) : [];
    const sideBIds = Array.isArray(m.sideBUserIds) ? m.sideBUserIds.map(String) : [];
    const sideATeam = m.sideATeamId ? String(m.sideATeamId) : null;
    const sideBTeam = m.sideBTeamId ? String(m.sideBTeamId) : null;
    const bId = m.bracketId ? String(m.bracketId) : null;

    return {
      id: String(m._id),
      matchNumber: Number(m.matchNumber ?? 0),
      roundNumber: Number(m.roundNumber ?? 1),
      bracketId: bId,
      bracketName: bId ? bracketNameMap.get(bId) || null : null,
      sideAUserIds: sideAIds,
      sideBUserIds: sideBIds,
      sideATeamId: sideATeam,
      sideBTeamId: sideBTeam,
      sideALabel: formatSideLabel(sideAIds, sideATeam, false),
      sideBLabel: formatSideLabel(sideBIds, sideBTeam, Boolean(m.isBye)),
      sideAPower: Number(m.sideAPower ?? 0),
      sideBPower: Number(m.sideBPower ?? 0),
      mapName: String(m.mapName || "To be announced"),
      format: String(m.format || summary.format),
      status: String(m.status || "scheduled"),
      channelId: m.channelId ? String(m.channelId) : null,
      scheduledAt: toIso(m.scheduledAt),
      deadlineAt: toIso(m.deadlineAt),
      proofUrl: typeof m.proofUrl === "string" ? m.proofUrl : null,
      reportedWinnerSide:
        m.reportedWinnerSide === "A" ||
        m.reportedWinnerSide === "B" ||
        m.reportedWinnerSide === "DRAW"
          ? m.reportedWinnerSide
          : null,
      submittedBy: m.submittedBy ? String(m.submittedBy) : null,
      reviewedBy: m.reviewedBy ? String(m.reviewedBy) : null,
      reviewNote: typeof m.reviewNote === "string" ? m.reviewNote : null,
      seriesId: typeof m.seriesId === "string" ? m.seriesId : null,
      seriesIndex: typeof m.seriesIndex === "number" ? m.seriesIndex : null,
      seriesBestOf: typeof m.seriesBestOf === "number" ? m.seriesBestOf : null,
      isBye: Boolean(m.isBye),
      createdAt: toIso(m.createdAt),
    };
  });

  const mappedTickets: SupportTicketRow[] = ticketDocs.map((tk) => ({
    id: String(tk._id),
    guildId: String(tk.guildId || ""),
    tournamentId: tk.tournamentId ? String(tk.tournamentId) : null,
    userId: String(tk.userId || ""),
    category: String(tk.category || "general"),
    description: String(tk.description || ""),
    channelId: tk.channelId ? String(tk.channelId) : null,
    status: String(tk.status || "open"),
    claimedBy: tk.claimedBy ? String(tk.claimedBy) : null,
    assignedTo: tk.assignedTo ? String(tk.assignedTo) : null,
    resolution: typeof tk.resolution === "string" ? tk.resolution : null,
    createdAt: toIso(tk.createdAt),
  }));

  const mappedAudits: AuditLogRow[] = auditDocs.map((a) => ({
    id: String(a._id),
    actorId: String(a.actorId || ""),
    action: String(a.action || ""),
    targetType: String(a.targetType || ""),
    targetId: String(a.targetId || ""),
    details: (a.details && typeof a.details === "object"
      ? a.details
      : {}) as Record<string, unknown>,
    createdAt: toIso(a.createdAt),
  }));

  return {
    tournament: summary,
    registrations: mappedRegs,
    teams: mappedTeams,
    matches: mappedMatches,
    tickets: mappedTickets,
    auditLogs: mappedAudits,
  };
}

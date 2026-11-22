export const TOURNAMENT_FORMATS = [
  "round_robin",
  "single_elimination",
  "double_elimination",
  "series",
  "swiss",
  "custom",
] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

export const TOURNAMENT_MODES = ["individual", "team"] as const;
export type TournamentMode = (typeof TOURNAMENT_MODES)[number];

export const SCORING_SYSTEMS = [
  "wins",
  "power",
  "points",
  "combined",
  "win_percentage",
] as const;
export type ScoringSystem = (typeof SCORING_SYSTEMS)[number];

export const TOURNAMENT_STATUSES = [
  "draft",
  "registration",
  "registration_closed",
  "matchmaking",
  "in_progress",
  "paused",
  "completed",
  "cancelled",
  "archived",
] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const TEAM_POWER_RULES = ["average", "all_members", "captain"] as const;
export type TeamPowerRule = (typeof TEAM_POWER_RULES)[number];

export const MATCH_STATUSES = [
  "scheduled",
  "ready",
  "in_progress",
  "pending_proof",
  "pending_review",
  "approved",
  "rejected",
  "disputed",
  "postponed",
  "forfeited",
  "cancelled",
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const TICKET_CATEGORIES = [
  "general",
  "registration",
  "team",
  "match",
  "report",
  "technical",
  "other",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_STATUSES = [
  "open",
  "claimed",
  "awaiting_player",
  "resolved",
  "closed",
  "escalated",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export interface BracketDTO {
  _id: string;
  name: string;
  minPower: number;
  maxPower: number | null;
  placementRules?: string;
  displayOrder?: number;
}

export interface FinalStandingDTO {
  bracket: string;
  place: number;
  userId?: string;
  teamId?: string;
  teamName?: string;
  wins: number;
  losses: number;
  points: number;
  power?: number | null;
}

export interface GameDTO {
  _id: string;
  guildId: string;
  name: string;
  nameLower: string;
  createdBy: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface TournamentDTO {
  _id: string;
  guildId: string;
  name: string;
  nameLower: string;
  gameId: string;
  gameName?: string;
  description: string;
  ownerId: string;
  managerRoleIds: string[];
  reviewerRoleIds?: string[];
  headManagerRoleIds?: string[];
  status: TournamentStatus;
  format: TournamentFormat;
  mode: TournamentMode;
  scoring: ScoringSystem;
  bracketsEnabled: boolean;
  brackets: BracketDTO[];
  teamSizeMin: number;
  teamSizeMax: number;
  teamPowerRule: TeamPowerRule;
  categoryId?: string | null;
  announcementChannelId?: string | null;
  maps: string[];
  schedule: {
    startAt?: string | null;
    endAt?: string | null;
    matchDeadlineHours?: number;
    matchDurationMinutes?: number;
  };
  resultPolicy: {
    proofRequired: boolean;
    approvalRequired: boolean;
    allowDraws: boolean;
  };
  tieBreakers: string[];
  swissRounds: number;
  seriesBestOf: number;
  allowMultipleTeams: boolean;
  allowIncompleteTeams?: boolean;
  teamInvitesOnly?: boolean;
  teamsLocked?: boolean;
  winWeight?: number;
  powerWeight?: number;
  pointsWeight?: number;
  leaderboardUpdateHours: number;
  awardRoleIds?: { first?: string; second?: string; third?: string };
  prizeDescriptions?: { first?: string; second?: string; third?: string };
  settingsLocked: boolean;
  standingsFrozen?: boolean;
  finalStandings?: FinalStandingDTO[];
  generatedRoundKeys?: string[];
  bracketChampions?: Record<string, string>;
  createdAt: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  counts?: {
    registrations: number;
    approvedPower: number;
    pendingPower: number;
    teams: number;
    matches: number;
    pendingReviews: number;
    disputed: number;
  };
}

export interface RegistrationDTO {
  _id: string;
  guildId: string;
  tournamentId: string;
  userId: string;
  displayName?: string;
  gameId: string;
  inGameId: string;
  powerValues: number[];
  claimedSquadPower: number;
  verifiedSquadPower: number | null;
  squadPowerProofUrl: string;
  squadPowerStatus: "pending" | "approved" | "rejected";
  verifiedBy?: string;
  verificationTimestamp?: string | null;
  bracketId: string | null;
  bracketOverride?: boolean;
  bracketOverrideReason?: string;
  teamId: string | null;
  teamIds: string[];
  status: "registered" | "withdrawn" | "removed" | "disqualified";
  wins: number;
  losses: number;
  points: number;
  managerPrivilegesSuspended?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamDTO {
  _id: string;
  guildId: string;
  tournamentId: string;
  name: string;
  nameLower: string;
  captainId: string;
  memberIds: string[];
  invitedIds?: string[];
  logoUrl?: string;
  bracketId?: string | null;
  status: "active" | "disbanded" | "disqualified";
  disqualificationReason?: string;
  createdAt: string;
}

export interface MatchDTO {
  _id: string;
  guildId: string;
  tournamentId: string;
  matchNumber: number;
  bracketId: string | null;
  sideAUserIds: string[];
  sideBUserIds: string[];
  sideATeamId: string | null;
  sideBTeamId: string | null;
  sideATeamName?: string | null;
  sideBTeamName?: string | null;
  sideAPower: number;
  sideBPower: number;
  mapName: string;
  format: TournamentFormat;
  roundNumber: number;
  status: MatchStatus;
  channelId?: string | null;
  channelCreationError?: boolean;
  isBye?: boolean;
  scheduledAt?: string | null;
  deadlineAt?: string | null;
  submittedBy?: string | null;
  submittedAt?: string | null;
  proofUrl?: string | null;
  reportedWinnerSide?: "A" | "B" | "DRAW" | null;
  reportedWinnerUserId?: string | null;
  reportedWinnerTeamId?: string | null;
  approvedWinnerUserId?: string | null;
  approvedWinnerTeamId?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  seriesId?: string | null;
  seriesIndex?: number | null;
  seriesBestOf?: number | null;
  seriesWinnerSide?: "A" | "B" | null;
  seriesDisputed?: boolean;
  appealBy?: string | null;
  appealReason?: string | null;
  forfeitReason?: string | null;
  overrideBy?: string | null;
  overrideReason?: string | null;
  statusNote?: string | null;
  createdAt: string;
}

export interface SupportTicketDTO {
  _id: string;
  guildId: string;
  tournamentId: string | null;
  userId: string;
  category: TicketCategory;
  description: string;
  channelId?: string | null;
  status: TicketStatus;
  claimedBy?: string | null;
  assignedTo?: string | null;
  resolution?: string | null;
  escalationReason?: string | null;
  createdAt: string;
}

export interface AuditLogDTO {
  _id: string;
  guildId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface SessionActor {
  id: string;
  discordId: string;
  name: string;
  email: string;
  image?: string | null;
  roleIds: string[];
  isBotAdmin: boolean;
  activeGuildId: string;
  }

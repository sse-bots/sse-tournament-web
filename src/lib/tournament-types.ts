export type TournamentFormat =
  | "round_robin"
  | "single_elimination"
  | "double_elimination"
  | "series"
  | "swiss"
  | "custom";

export type TournamentMode = "individual" | "team";

export type TournamentScoring =
  | "wins"
  | "power"
  | "points"
  | "combined"
  | "win_percentage";

export type TournamentStatus =
  | "draft"
  | "registration"
  | "registration_closed"
  | "matchmaking"
  | "in_progress"
  | "paused"
  | "completed"
  | "cancelled"
  | "archived";

export type TeamPowerRule = "average" | "all_members" | "captain";

export interface PowerBracket {
  id: string;
  name: string;
  minPower: number;
  maxPower: number | null;
  displayOrder?: number;
}

export interface FinalStandingRow {
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

export interface TournamentSummary {
  id: string;
  guildId: string;
  name: string;
  gameId: string;
  gameName: string;
  description: string;
  ownerId: string;
  status: TournamentStatus;
  format: TournamentFormat;
  mode: TournamentMode;
  scoring: TournamentScoring;
  bracketsEnabled: boolean;
  brackets: PowerBracket[];
  teamSizeMin: number;
  teamSizeMax: number;
  teamPowerRule: TeamPowerRule;
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
  allowIncompleteTeams: boolean;
  teamInvitesOnly: boolean;
  leaderboardUpdateHours: number;
  prizeDescriptions: {
    first?: string;
    second?: string;
    third?: string;
  };
  settingsLocked: boolean;
  teamsLocked: boolean;
  standingsFrozen: boolean;
  finalStandings: FinalStandingRow[];
  counts: {
    registrations: number;
    pendingPower: number;
    teams: number;
    matches: number;
    pendingReview: number;
    disputed: number;
  };
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface RegistrationRow {
  id: string;
  userId: string;
  inGameId: string;
  powerValues: number[];
  claimedSquadPower: number | null;
  verifiedSquadPower: number | null;
  squadPowerProofUrl: string | null;
  squadPowerStatus: "pending" | "approved" | "rejected" | string;
  bracketId: string | null;
  bracketName: string | null;
  bracketOverride: boolean;
  teamId: string | null;
  teamName: string | null;
  status: string;
  wins: number;
  losses: number;
  points: number;
  winRate: number;
  createdAt: string | null;
}

export interface TeamRow {
  id: string;
  name: string;
  captainId: string;
  memberIds: string[];
  invitedIds: string[];
  logoUrl: string | null;
  bracketId: string | null;
  bracketName: string | null;
  status: string;
  wins: number;
  losses: number;
  points: number;
  played: number;
  winRate: number;
  verifiedPower: number;
  createdAt: string | null;
}

export interface MatchRow {
  id: string;
  matchNumber: number;
  roundNumber: number;
  bracketId: string | null;
  bracketName: string | null;
  sideAUserIds: string[];
  sideBUserIds: string[];
  sideATeamId: string | null;
  sideBTeamId: string | null;
  sideALabel: string;
  sideBLabel: string;
  sideAPower: number;
  sideBPower: number;
  mapName: string;
  format: string;
  status: string;
  channelId: string | null;
  scheduledAt: string | null;
  deadlineAt: string | null;
  proofUrl: string | null;
  reportedWinnerSide: "A" | "B" | "DRAW" | null;
  submittedBy: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  seriesId: string | null;
  seriesIndex: number | null;
  seriesBestOf: number | null;
  isBye: boolean;
  createdAt: string | null;
}

export interface SupportTicketRow {
  id: string;
  guildId: string;
  tournamentId: string | null;
  userId: string;
  category: string;
  description: string;
  channelId: string | null;
  status: string;
  claimedBy: string | null;
  assignedTo: string | null;
  resolution: string | null;
  createdAt: string | null;
}

export interface AuditLogRow {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  createdAt: string | null;
}

export interface GameRow {
  id: string;
  guildId: string;
  name: string;
  active: boolean;
  createdBy: string;
  createdAt: string | null;
}

export interface SessionUser {
  sub: string;
  name: string;
  username: string | null;
  email: string | null;
  image: string | null;
  discordId: string | null;
  discordUsername: string | null;
  sseRole: string;
  sseRoles: string[];
  ssePermissions: string[];
  sseBadges: string[];
  sseVerified: boolean;
  isGlobalAdmin: boolean;
}

export interface ManagedGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  canManage: boolean;
  botConfigured: boolean;
  tournamentCount: number;
  gameCount: number;
}

export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  round_robin: "Round Robin",
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
  series: "Best-of Series",
  swiss: "Swiss System",
  custom: "Custom Matches",
};

export const SCORING_LABELS: Record<TournamentScoring, string> = {
  wins: "Total Wins",
  points: "Points (3W / 1D)",
  win_percentage: "Win Percentage",
  power: "Squad Power",
  combined: "Weighted Combined",
};

export const STATUS_META: Record<
  TournamentStatus,
  { label: string; color: string; bg: string; pulse?: boolean }
> = {
  draft: { label: "Draft", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.16)" },
  registration: { label: "Registration Open", color: "#34d399", bg: "rgba(16, 185, 129, 0.16)", pulse: true },
  registration_closed: { label: "Registration Closed", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.16)" },
  matchmaking: { label: "Matchmaking", color: "#a78bfa", bg: "rgba(139, 92, 246, 0.16)" },
  in_progress: { label: "Live In Progress", color: "#fbbf24", bg: "rgba(245, 158, 11, 0.18)", pulse: true },
  paused: { label: "Paused", color: "#fb923c", bg: "rgba(249, 115, 22, 0.16)" },
  completed: { label: "Completed", color: "#4ade80", bg: "rgba(34, 197, 94, 0.16)" },
  cancelled: { label: "Cancelled", color: "#fb7185", bg: "rgba(244, 63, 94, 0.16)" },
  archived: { label: "Archived", color: "#64748b", bg: "rgba(100, 116, 139, 0.16)" },
};

export const MATCH_STATUS_COLORS: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  scheduled: { label: "Scheduled", color: "#94a3b8", bg: "rgba(148,163,184,0.16)" },
  ready: { label: "Ready", color: "#38bdf8", bg: "rgba(56,189,248,0.16)" },
  in_progress: { label: "In Progress", color: "#fbbf24", bg: "rgba(245,158,11,0.18)" },
  pending_proof: { label: "Pending Proof", color: "#fb923c", bg: "rgba(249,115,22,0.16)" },
  pending_review: { label: "Pending Review", color: "#c084fc", bg: "rgba(168,85,247,0.18)" },
  approved: { label: "Approved", color: "#34d399", bg: "rgba(16,185,129,0.16)" },
  rejected: { label: "Rejected", color: "#fb7185", bg: "rgba(244,63,94,0.16)" },
  disputed: { label: "Disputed", color: "#f43f5e", bg: "rgba(244,63,94,0.22)" },
  forfeited: { label: "Forfeited", color: "#f59e0b", bg: "rgba(245,158,11,0.16)" },
  postponed: { label: "Postponed", color: "#94a3b8", bg: "rgba(148,163,184,0.16)" },
  cancelled: { label: "Cancelled", color: "#64748b", bg: "rgba(100,116,139,0.16)" },
};

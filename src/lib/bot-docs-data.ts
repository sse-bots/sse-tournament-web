export type DocCommandCategory =
  | "activation"
  | "games"
  | "tournaments"
  | "brackets"
  | "registration"
  | "teams"
  | "matches"
  | "standings"
  | "availability"
  | "support";

export interface BotCommandParam {
  name: string;
  required: boolean;
  type: string;
  description: string;
  autocomplete?: boolean;
}

export interface BotCommandDoc {
  command: string;
  category: DocCommandCategory;
  permission:
    | "Everyone"
    | "Server Owner / Admin"
    | "Manage Server"
    | "Tournament Manager"
    | "Manager / Reviewer"
    | "Team Captain"
    | "Participant"
    | "Support Staff";
  summary: string;
  example: string;
  notes?: string;
  params: BotCommandParam[];
}

export const DOC_CATEGORIES: Array<{
  id: DocCommandCategory;
  label: string;
  description: string;
}> = [
  { id: "activation", label: "Activation & Server Setup", description: "License keys, channel scaffolding, log channels, and safe cleanup." },
  { id: "games", label: "Games Catalog", description: "Register games like Mech Arena, Free Fire, and Minecraft." },
  { id: "tournaments", label: "Tournaments & Lifecycle", description: "Create, configure, open/close registration, start, pause, finish, and archive." },
  { id: "brackets", label: "Squad-Power Brackets", description: "Optional SP/XP brackets with overlap guards and manager overrides." },
  { id: "registration", label: "Registration & Power Review", description: "Player sign-up with average SP screenshots and manager verification." },
  { id: "teams", label: "Teams & Rosters", description: "Captain invites, roster lock, substitutions, and disqualifications." },
  { id: "matches", label: "Matchmaking & Matches", description: "Automated pairings, private match rooms, proof review, series, and disputes." },
  { id: "standings", label: "Standings, Stats & Export", description: "Live/frozen leaderboards, player & team analytics, and CSV export." },
  { id: "availability", label: "Scheduling Availability", description: "Timezone-aware player time windows for conflict-free auto-scheduling." },
  { id: "support", label: "Support Tickets & Audit", description: "Private ticket rooms, escalations, transcripts, and immutable audit logs." },
];

export const QUICKSTART_STEPS = [
  {
    step: 1,
    title: "Activate Your Discord Server",
    command: "/activate key:<YOUR_SINGLE_USE_KEY>",
    detail:
      "Generate a key for SSE Tournament Bot in SSE Nexus, invite the bot with Manage Channels & Manage Roles permissions (and Server Members Intent enabled), then run /activate. Before activation, only /activate is visible in your server.",
  },
  {
    step: 2,
    title: "Scaffold Tournament Channels",
    command: "/setup",
    detail:
      "Automatically creates the 'SSE Tournaments' category with #announcements, #registration, #discussion, #leaderboard, #match-directory, and #support, and saves their IDs in MongoDB.",
  },
  {
    step: 3,
    title: "Add Your Game & Create a Tournament",
    command: "/game create name:Mech Arena",
    detail:
      "Add one or more games, then run /tournament create selecting the game from the live dropdown, choosing format (round_robin, single_elimination, double_elimination, series, swiss, or custom), mode (individual/team), scoring, brackets toggle, and a manager role.",
  },
  {
    step: 4,
    title: "Add Brackets, Maps, Prizes & Open Registration",
    command: "/bracket add tournament_id:<ID> name:Tier 1 min_power:0 max_power:3500",
    detail:
      "Configure SP brackets (if enabled), maps, schedule window, prizes (/tournament prizes), and award roles (/tournament award-roles), then run /tournament registration open.",
  },
  {
    step: 5,
    title: "Verify Squad Power & Launch Matchmaking",
    command: "/squadpower review tournament_id:<ID> player:@User decision:Approve",
    detail:
      "Players register via /register with comma-separated squad power values and a screenshot. Approve submissions, close registration (/tournament registration close), preview with /matchmaking_preview, and generate private match channels with /matchmaking.",
  },
  {
    step: 6,
    title: "Review Proof, Auto-Advance & Freeze Final Standings",
    command: "/match review match_id:<ID> decision:Approve",
    detail:
      "Participants upload screenshots inside their private match channel with /match submit. Approving results updates standings and automatically creates the next round (or next game in Best-of series). When done, run /tournament finish to freeze standings, announce podiums, and grant award roles.",
  },
];

export const FORMAT_GUIDES = [
  {
    id: "single_elimination",
    name: "Single Elimination",
    badge: "Knockout",
    draws: "No Draws",
    description:
      "Classic knockout bracket. Winners automatically advance when every match in the current round is approved. Odd entrant counts receive an automatic bye record.",
    bestFor: "Fast 1-day cups, 1v1 Minecraft PvP, high-stakes Mech Arena playoffs.",
  },
  {
    id: "double_elimination",
    name: "Double Elimination",
    badge: "Two-Loss Bracket",
    draws: "No Draws",
    description:
      "Entrants remain alive until they suffer 2 losses. Later rounds prioritize pairing players with equal loss counts while avoiding repeat opponents wherever possible.",
    bestFor: "Competitive weekend majors where one upset shouldn't end a run.",
  },
  {
    id: "round_robin",
    name: "Round Robin",
    badge: "All-Play-All",
    draws: "Optional",
    description:
      "Schedules every round upfront using a circle rotation so every entrant faces every other entrant in their bracket. Ideal for league stages.",
    bestFor: "Small-to-medium leagues (4–12 players/teams per bracket).",
  },
  {
    id: "swiss",
    name: "Swiss System",
    badge: "Score-Matched",
    draws: "No Draws",
    description:
      "Pairs entrants with similar win/point totals each round without eliminating anyone early and avoids rematches. Defaults to ceil(log2(entrants)) rounds or custom swiss_rounds.",
    bestFor: "Large communities (16–64 entrants) wanting everyone to play multiple rounds.",
  },
  {
    id: "series",
    name: "Best-of Series (Bo3 / Bo5)",
    badge: "Multi-Game",
    draws: "No Draws",
    description:
      "Creates Game 1 and automatically spawns Game 2, 3, etc. until one side clinches a majority (seriesBestOf // 2 + 1). Counts as 1 series win on standings with dedicated /match series-appeal support.",
    bestFor: "Mech Arena Hangar duels and championship finals.",
  },
  {
    id: "custom",
    name: "Custom Matches",
    badge: "Manager-Crafted",
    draws: "Optional",
    description:
      "Full manual control: close registration, hand-craft pairings with /match create, then call /tournament start.",
    bestFor: "Showmatches, invitational gauntlets, or hybrid community events.",
  },
];

export const SCORING_GUIDES = [
  { key: "wins", name: "Wins (Default)", formula: "Sorted by total Wins -> tie-breakers", detail: "Standard win-first leaderboard ideal for knockout and series formats." },
  { key: "points", name: "Points", formula: "Win = +3 pts · Draw = +1 pt · Loss = 0 pts", detail: "Best for Round Robin leagues where draws are enabled." },
  { key: "win_percentage", name: "Win Percentage", formula: "Wins / (Wins + Losses)", detail: "Fair ranking when entrants have unequal total matches played." },
  { key: "power", name: "Squad Power", formula: "Ranked by Verified Average Squad Power", detail: "Useful for power-seeding ladders or hangar showcases." },
  { key: "combined", name: "Weighted Combined", formula: "Wins*winWeight + Power*powerWeight + Points*pointsWeight", detail: "Configure custom integer weights in /tournament configure." },
];

export const GAME_PLAYBOOKS = [
  {
    game: "Mech Arena",
    accent: "#06b6d4",
    recommended: "Format: series (Bo3) or double_elimination · Mode: individual · Brackets: Enabled",
    steps: [
      "Run /game create name:Mech Arena",
      "Create tournament with brackets:True and scoring:wins.",
      "Add SP brackets like Rookie (0–2500), Veteran (2501–5000), Legend (5001+).",
      "Players submit hangar values via /register squad_power_values:3200,3400,3100 proof:<screenshot> — the bot averages them automatically.",
      "Set maps_csv:Agora,Skyship,Forbidden City,Canal and prizes in A-Coins / Credits.",
    ],
  },
  {
    game: "Free Fire",
    accent: "#f59e0b",
    recommended: "Format: round_robin or custom · Mode: team (4v4 Squads) · Scoring: points",
    steps: [
      "Run /game create name:Free Fire",
      "Create tournament with mode:team team_size_min:4 team_size_max:5 team_power_rule:average.",
      "Captains run /team create and invite squadmates with /team invite (or open join).",
      "Configure maps_csv:Bermuda,Purgatory,Kalahari,NeXTerra and enable proof_required:True.",
      "Review end-screen screenshots in private match rooms or directly on this web dashboard.",
    ],
  },
  {
    game: "Minecraft",
    accent: "#10b981",
    recommended: "Format: swiss or single_elimination · Mode: individual or team (2v2) · Brackets: Disabled",
    steps: [
      "Run /game create name:Minecraft",
      "Create tournament with brackets:False (players can enter 0 for squad_power_values with a skin/IGN proof screenshot).",
      "Set schedule start/end dates (with timezone like +05:30) and ask players to submit /availability set.",
      "Run /matchmaking then /match schedule-all for conflict-free automatic match times and 24h reminders.",
    ],
  },
];

export const BOT_COMMANDS: BotCommandDoc[] = [
  { command: "/activate", category: "activation", permission: "Server Owner / Admin", summary: "Activate SSE Tournament Bot in your Discord server using a single-use key from SSE Nexus.", example: "/activate key:SSE-XXXX-XXXX-XXXX", notes: "Unlocks and syncs the entire tournament slash command tree to your server immediately.", params: [{ name: "key", required: true, type: "string", description: "Single-use activation key generated for SSE Tournament Bot." }] },
  { command: "/deactivate", category: "activation", permission: "Server Owner / Admin", summary: "Temporarily disable SSE Tournament Bot in this server without losing your activation.", example: "/deactivate", notes: "Replaces server commands with /reactivate until restored.", params: [] },
  { command: "/reactivate", category: "activation", permission: "Server Owner / Admin", summary: "Restore a previously deactivated SSE Tournament Bot license in this server.", example: "/reactivate", params: [] },
  { command: "/remove", category: "activation", permission: "Server Owner / Admin", summary: "Permanently remove this server's activation record. Requires a new key afterward.", example: "/remove confirm:True", params: [{ name: "confirm", required: true, type: "boolean", description: "Must be True to permanently remove activation." }] },
  { command: "/setup", category: "activation", permission: "Server Owner / Admin", summary: "Create the 'SSE Tournaments' category and 6 base channels (#announcements, #registration, #discussion, #leaderboard, #match-directory, #support).", example: "/setup", params: [] },
  { command: "/cleanup", category: "activation", permission: "Server Owner / Admin", summary: "Remove all bot-created setup, match, and ticket channels while preserving MongoDB tournament history.", example: "/cleanup confirm:True", params: [{ name: "confirm", required: true, type: "boolean", description: "Must be True to delete bot-created channels." }] },
  { command: "/config show", category: "activation", permission: "Manage Server", summary: "Display the server's configured category, channels, log channel, and support staff role.", example: "/config show", params: [] },
  { command: "/config log-channel", category: "activation", permission: "Manage Server", summary: "Set the server channel used for round generation logs and automated tournament alerts.", example: "/config log-channel channel:#bot-logs", params: [{ name: "channel", required: true, type: "TextChannel", description: "Target text channel for bot logs." }] },
  { command: "/config support-role", category: "activation", permission: "Manage Server", summary: "Set the Discord role authorized to view, claim, resolve, and close private support tickets.", example: "/config support-role role:@Support Staff", params: [{ name: "role", required: true, type: "Role", description: "Support staff Discord role." }] },
  { command: "/game create", category: "games", permission: "Manage Server", summary: "Add an active game (e.g. Mech Arena, Free Fire, Minecraft) to your server's game catalog.", example: "/game create name:Mech Arena", params: [{ name: "name", required: true, type: "string", description: "Unique display name for the game." }] },
  { command: "/game list", category: "games", permission: "Everyone", summary: "List all active games configured in this server along with their MongoDB IDs.", example: "/game list", params: [] },
  { command: "/game edit", category: "games", permission: "Manage Server", summary: "Rename an existing game without breaking linked tournaments.", example: "/game edit current_name:Mech Arena new_name:Mech Arena India", params: [{ name: "current_name", required: true, type: "string", description: "Existing game.", autocomplete: true }, { name: "new_name", required: true, type: "string", description: "New unique game name." }] },
  { command: "/game delete", category: "games", permission: "Manage Server", summary: "Deactivate a game so it no longer appears when creating new tournaments.", example: "/game delete name:Old Game", params: [{ name: "name", required: true, type: "string", description: "Game to deactivate.", autocomplete: true }] },
  { command: "/tournament create", category: "tournaments", permission: "Manage Server", summary: "Create a new tournament in Draft status with full format, mode, scoring, brackets, and manager role settings.", example: "/tournament create name:SSE MA Cup game:Mech Arena format:Series mode:Individual scoring:Wins brackets:True manager_role:@Tourney Mod", params: [{ name: "name", required: true, type: "string", description: "Tournament title." }, { name: "game", required: true, type: "string", description: "Select active game.", autocomplete: true }, { name: "format", required: true, type: "choice", description: "round_robin, single_elimination, double_elimination, series, swiss, or custom." }, { name: "mode", required: true, type: "choice", description: "individual or team." }, { name: "scoring", required: true, type: "choice", description: "wins, power, points, combined, or win_percentage." }, { name: "brackets", required: true, type: "boolean", description: "Enable optional squad-power brackets." }, { name: "manager_role", required: true, type: "Role", description: "Discord role authorized to manage this tournament." }] },
  { command: "/tournament list", category: "tournaments", permission: "Everyone", summary: "List active and recent non-archived tournaments in the server with IDs and statuses.", example: "/tournament list", params: [] },
  { command: "/tournament configure", category: "tournaments", permission: "Tournament Manager", summary: "Configure maps pool, ISO-8601 schedule window, deadline hours, result proof policy, Swiss rounds, Best-of series, team rules, tie-breakers, and periodic leaderboard updates.", example: "/tournament configure tournament_id:<ID> maps_csv:Agora,Skyship series_best_of:3 proof_required:True", notes: "Locked automatically once the tournament starts. Dates must include a timezone offset such as +05:30 or Z.", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "maps_csv", required: false, type: "string", description: "Comma-separated list of up to 25 maps." }, { name: "start_at / end_at", required: false, type: "ISO-8601", description: "Timezone-aware schedule window (e.g. 2026-12-01T18:00:00+05:30)." }, { name: "match_deadline_hours", required: false, type: "int (1–720)", description: "Hours after match start before deadline alerts fire." }, { name: "proof_required / approval_required / allow_draws", required: false, type: "boolean", description: "Result submission and review policy." }, { name: "swiss_rounds / series_best_of", required: false, type: "int", description: "Swiss round cap (0 = auto) or odd Best-of series count (1, 3, 5...)." }] },
  { command: "/tournament edit", category: "tournaments", permission: "Tournament Manager", summary: "Edit a tournament's name or description before settings lock at tournament start.", example: "/tournament edit tournament_id:<ID> description:Updated rules", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "name", required: false, type: "string", description: "New tournament name." }, { name: "description", required: false, type: "string", description: "New tournament description." }] },
  { command: "/tournament prizes", category: "tournaments", permission: "Tournament Manager", summary: "Set prize descriptions for 1st, 2nd, and 3rd place (displayed in final results and on the web hub).", example: "/tournament prizes tournament_id:<ID> first_prize:2000 A-Coins second_prize:1000 A-Coins", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "first_prize / second_prize / third_prize", required: false, type: "string", description: "Prize text per podium slot." }] },
  { command: "/tournament award-roles", category: "tournaments", permission: "Tournament Manager", summary: "Configure Discord roles automatically awarded to 1st, 2nd, and 3rd place finishers on /tournament finish.", example: "/tournament award-roles tournament_id:<ID> first:@Champion second:@Runner-Up", notes: "Ensure the bot has Manage Roles and sits higher in the Discord role hierarchy than award roles.", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "first / second / third", required: false, type: "Role", description: "Discord roles for podium winners." }] },
  { command: "/tournament announcement-channel", category: "tournaments", permission: "Tournament Manager", summary: "Override which channel receives announcements, schedules, periodic standings, and final winners for this tournament.", example: "/tournament announcement-channel tournament_id:<ID> channel:#ma-announcements", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "channel", required: true, type: "TextChannel", description: "Target announcement channel." }] },
  { command: "/tournament add-manager-role / remove-manager-role", category: "tournaments", permission: "Tournament Manager", summary: "Add or remove Discord roles authorized to manage the tournament (also supports reviewer-role and head-manager-role).", example: "/tournament add-reviewer-role tournament_id:<ID> role:@Match Referee", notes: "Fair-play guard: any staff member who registers as a participant automatically has manager/reviewer actions suspended for that tournament.", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "role", required: true, type: "Role", description: "Discord role to grant or revoke." }] },
  { command: "/tournament registration open / close / reopen", category: "tournaments", permission: "Tournament Manager", summary: "Open registration for players, close registration (locks team rosters), or reopen before matchmaking.", example: "/tournament registration open tournament_id:<ID>", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }] },
  { command: "/tournament registration remove-player / disqualify-player", category: "tournaments", permission: "Tournament Manager", summary: "Remove a player before matchmaking or disqualify a participant (and their active team) with a logged reason.", example: "/tournament registration disqualify-player tournament_id:<ID> player:@User reason:No-show", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "player", required: true, type: "User", description: "Participant to remove or disqualify." }, { name: "reason", required: true, type: "string", description: "Mandatory audit reason." }] },
  { command: "/tournament start / pause / resume", category: "tournaments", permission: "Tournament Manager", summary: "Start play (locking settings/teams), pause all result submissions & reviews, or resume play.", example: "/tournament pause tournament_id:<ID> reason:Maintenance", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }] },
  { command: "/tournament finish", category: "tournaments", permission: "Tournament Manager", summary: "Freeze final standings snapshot, publish podium announcements with prizes, and assign configured Discord award roles.", example: "/tournament finish tournament_id:<ID> force:False", notes: "Blocks if unresolved matches exist unless force:True.", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "force", required: false, type: "boolean", description: "Allow finishing even with unresolved matches." }] },
  { command: "/tournament winners / results", category: "tournaments", permission: "Everyone", summary: "Display frozen final podium placements (/tournament winners) or finalized match results (/tournament results).", example: "/tournament winners tournament_id:<ID>", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }] },
  { command: "/tournament clone / cancel / archive / delete", category: "tournaments", permission: "Tournament Manager", summary: "Clone settings into a fresh draft, cancel with reason, archive completed events, or permanently delete a tournament.", example: "/tournament clone tournament_id:<ID> new_name:Season 2 Cup", notes: "Deletion is blocked if disputed matches exist.", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }] },
  { command: "/announce", category: "tournaments", permission: "Tournament Manager", summary: "Post a formatted announcement embed for a tournament into its announcement channel or a chosen channel.", example: "/announce tournament_id:<ID> message:Round 2 matches are live!", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "message", required: true, type: "string", description: "Announcement body." }] },
  { command: "/bracket add", category: "brackets", permission: "Tournament Manager", summary: "Add an average Squad Power bracket range (min_power to max_power or infinity) with automatic overlap protection.", example: "/bracket add tournament_id:<ID> name:Tier 2 min_power:3501 max_power:6000", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "name", required: true, type: "string", description: "Bracket name." }, { name: "min_power", required: true, type: "number", description: "Minimum average squad power." }, { name: "max_power", required: false, type: "number", description: "Maximum power (blank = infinity)." }] },
  { command: "/bracket list / edit / reorder / delete", category: "brackets", permission: "Tournament Manager", summary: "View brackets (/bracket list is public), edit ranges/names, set display order, or delete before tournament start.", example: "/bracket edit tournament_id:<ID> bracket_name:Tier 1 max_power:3800", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "bracket_name", required: false, type: "string", description: "Bracket selector.", autocomplete: true }] },
  { command: "/bracket move-player", category: "brackets", permission: "Tournament Manager", summary: "Manually override a registered participant's bracket assignment before matchmaking with an audit reason.", example: "/bracket move-player tournament_id:<ID> player:@User bracket_name:Tier 2 reason:Borderline hangar", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "player", required: true, type: "User", description: "Registered participant." }, { name: "bracket_name", required: true, type: "string", description: "Destination bracket.", autocomplete: true }, { name: "reason", required: true, type: "string", description: "Mandatory audit reason." }] },
  { command: "/register", category: "registration", permission: "Everyone", summary: "Register for an open tournament by submitting comma-separated squad-power values (auto-averaged) and an image screenshot proof.", example: "/register tournament_id:<ID> squad_power_values:4100,4250,3950 proof:<image> in_game_id:12345678", notes: "If a tournament manager registers, their management privileges are automatically suspended for that tournament.", params: [{ name: "tournament_id", required: true, type: "string", description: "Open tournament.", autocomplete: true }, { name: "squad_power_values", required: true, type: "string", description: "Comma-separated non-negative numbers." }, { name: "proof", required: true, type: "Image Attachment", description: "Screenshot evidence." }, { name: "in_game_id", required: false, type: "string", description: "Your in-game ID or IGN." }] },
  { command: "/unregister", category: "registration", permission: "Participant", summary: "Withdraw from a tournament before matchmaking starts.", example: "/unregister tournament_id:<ID>", params: [{ name: "tournament_id", required: true, type: "string", description: "Tournament to withdraw from.", autocomplete: true }] },
  { command: "/squadpower review", category: "registration", permission: "Tournament Manager", summary: "Approve or reject a player's submitted squad-power proof screenshot and automatically assign their bracket.", example: "/squadpower review tournament_id:<ID> player:@User decision:Approve", notes: "Can also be reviewed visually in the Manager Dashboard.", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "player", required: true, type: "User", description: "Player to review." }, { name: "decision", required: true, type: "choice", description: "Approve or Reject." }] },
  { command: "/squadpower adjust", category: "registration", permission: "Tournament Manager", summary: "Manually correct a player's verified average squad power before tournament start with an audit reason.", example: "/squadpower adjust tournament_id:<ID> player:@User verified_average:4320 reason:Screenshot typo", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "player", required: true, type: "User", description: "Registered player." }, { name: "verified_average", required: true, type: "number", description: "Corrected average SP." }, { name: "reason", required: true, type: "string", description: "Audit reason." }] },
  { command: "/team create / join / leave / list", category: "teams", permission: "Participant", summary: "Create a squad as captain, join an open team, leave before roster lock, or browse active teams.", example: "/team create tournament_id:<ID> name:SSE Strikers", params: [{ name: "tournament_id", required: true, type: "string", description: "Team-mode tournament.", autocomplete: true }, { name: "name / team_name", required: false, type: "string", description: "Team name.", autocomplete: true }] },
  { command: "/team invite / accept", category: "teams", permission: "Team Captain", summary: "Invite a registered player via DM (/team invite) and accept pending team invitations (/team accept).", example: "/team invite tournament_id:<ID> team_name:SSE Strikers player:@Teammate", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "team_name", required: true, type: "string", description: "Your team name.", autocomplete: true }] },
  { command: "/team edit / transfer-captain / delete", category: "teams", permission: "Team Captain", summary: "Rename team or set an HTTPS logo URL, pass captaincy to another member, or disband before roster lock.", example: "/team edit tournament_id:<ID> current_name:SSE Strikers logo_url:https://...", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }] },
  { command: "/team kick / substitute / disqualify", category: "teams", permission: "Tournament Manager", summary: "Remove a member, substitute an outgoing player (auto-updating private match channel permissions), or disqualify a team.", example: "/team substitute tournament_id:<ID> team_name:SSE Strikers outgoing:@Old incoming:@Sub reason:Sub", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "team_name", required: true, type: "string", description: "Target team.", autocomplete: true }, { name: "reason", required: true, type: "string", description: "Mandatory audit reason." }] },
  { command: "/matchmaking_preview", category: "matches", permission: "Tournament Manager", summary: "Preview proposed pairings and byes per bracket without creating any Discord channels or database match records.", example: "/matchmaking_preview tournament_id:<ID>", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }] },
  { command: "/matchmaking", category: "matches", permission: "Tournament Manager", summary: "Generate matches for all eligible verified entrants, create private match channels, lock settings, and start the tournament.", example: "/matchmaking tournament_id:<ID>", notes: "Close registration first. Round-robin builds all rounds; Single/Double Elim & Swiss auto-generate later rounds as results are approved.", params: [{ name: "tournament_id", required: true, type: "string", description: "Registration-closed tournament.", autocomplete: true }] },
  { command: "/matchmaking_regenerate", category: "matches", permission: "Tournament Manager", summary: "Delete all unstarted scheduled matches and their channels so you can re-run /matchmaking.", example: "/matchmaking_regenerate tournament_id:<ID> confirm:True", notes: "Blocked if any match has started, is pending review, or is disputed.", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "confirm", required: true, type: "boolean", description: "Must be True." }] },
  { command: "/match create", category: "matches", permission: "Tournament Manager", summary: "Manually create a match (for Custom format or rematches) with team names or comma-separated user IDs.", example: "/match create tournament_id:<ID> side_a:Team Alpha side_b:Team Beta map_name:Agora", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "side_a / side_b", required: true, type: "string", description: "Team name or comma-separated Discord user IDs." }] },
  { command: "/match submit", category: "matches", permission: "Participant", summary: "Submit a match result (Side A, Side B, or Draw if enabled) with screenshot proof inside your private match channel.", example: "/match submit match_id:<ID> winner_side:Side A proof:<screenshot>", params: [{ name: "match_id", required: true, type: "string", description: "Match ID.", autocomplete: true }, { name: "winner_side", required: true, type: "choice", description: "Side A, Side B, or Draw." }, { name: "proof", required: false, type: "Image Attachment", description: "Required unless proofRequired is disabled." }] },
  { command: "/match review", category: "matches", permission: "Manager / Reviewer", summary: "Approve, reject, or dispute a submitted result. Approving updates standings and auto-triggers next-round / next-series-game creation.", example: "/match review match_id:<ID> decision:Approve note:Verified clean", params: [{ name: "match_id", required: true, type: "string", description: "Match with pending proof.", autocomplete: true }, { name: "decision", required: true, type: "choice", description: "Approve, Reject, or Dispute." }] },
  { command: "/match schedule-all / reschedule", category: "matches", permission: "Tournament Manager", summary: "Auto-schedule unscheduled matches within the tournament window respecting player availability & avoiding overlaps, or reschedule one match.", example: "/match schedule-all tournament_id:<ID> confirm:True", notes: "Background worker automatically sends 24h reminders, overdue alerts, and 6h deadline warnings.", params: [{ name: "tournament_id / match_id", required: true, type: "string", description: "Target tournament or match.", autocomplete: true }] },
  { command: "/match view / edit / status / repair-channel / history", category: "matches", permission: "Manager / Reviewer", summary: "Inspect match details & audit trail, edit map/deadline, mark Ready/In-Progress/Postponed, or recreate a missing private channel.", example: "/match repair-channel match_id:<ID>", params: [{ name: "match_id", required: true, type: "string", description: "Target match.", autocomplete: true }] },
  { command: "/match request-proof / appeal / resolve-dispute", category: "matches", permission: "Manager / Reviewer", summary: "Ask participants for clearer screenshots, allow participants to appeal a result, and resolve disputes.", example: "/match resolve-dispute match_id:<ID> decision:Award Side A reason:Verified evidence", params: [{ name: "match_id", required: true, type: "string", description: "Target match.", autocomplete: true }, { name: "reason", required: true, type: "string", description: "Logged justification." }] },
  { command: "/match series-appeal / series-resolve", category: "matches", permission: "Manager / Reviewer", summary: "Appeal a finalized Best-of series outcome (notifying Head Managers) and resolve disputed series atomically.", example: "/match series-resolve match_id:<ID> decision:Side A wins series reason:Verified", params: [{ name: "match_id", required: true, type: "string", description: "Any match ID in the series.", autocomplete: true }, { name: "reason", required: true, type: "string", description: "Resolution reason." }] },
  { command: "/match forfeit / override / reopen / cancel", category: "matches", permission: "Tournament Manager", summary: "Award a no-show forfeit, perform an Admin-only result override (reversing old points first), reopen for fresh proof, or cancel.", example: "/match forfeit match_id:<ID> winner_side:Side A reason:No-show", notes: "/match override and reopening finalized matches require Server Administrator permission.", params: [{ name: "match_id", required: true, type: "string", description: "Target match.", autocomplete: true }, { name: "reason", required: true, type: "string", description: "Mandatory audit reason." }] },
  { command: "/leaderboard / team_leaderboard / standings", category: "standings", permission: "Everyone", summary: "Display ranked individual or team standings with W/L, points, win rate, and power, optionally filtered by bracket.", example: "/standings tournament_id:<ID> bracket_name:Tier 1", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }, { name: "bracket_name", required: false, type: "string", description: "Optional bracket filter.", autocomplete: true }] },
  { command: "/stats player / stats team", category: "standings", permission: "Everyone", summary: "Inspect detailed tournament record, win percentage, approved match count, and verified average squad power.", example: "/stats player tournament_id:<ID> player:@User", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }] },
  { command: "/export results", category: "standings", permission: "Tournament Manager", summary: "Download a lossless UTF-8 CSV file containing all participant rows, match rows, and frozen final placements.", example: "/export results tournament_id:<ID>", notes: "Also available as a 1-click button on every tournament page in this web dashboard!", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }] },
  { command: "/availability set / list / clear", category: "availability", permission: "Participant", summary: "Submit timezone-aware available or unavailable time windows so /match schedule-all avoids conflicts.", example: "/availability set tournament_id:<ID> start_at:2026-12-05T14:00:00+05:30 end_at:2026-12-05T20:00:00+05:30 available_window:True", params: [{ name: "tournament_id", required: true, type: "string", description: "Target tournament.", autocomplete: true }] },
  { command: "/support create", category: "support", permission: "Everyone", summary: "Open a private support ticket channel visible only to you, configured support staff, and non-participating tournament managers.", example: "/support create category:Match description:Opponent absent tournament_id:<ID>", params: [{ name: "category", required: true, type: "choice", description: "general, registration, team, match, report, technical, or other." }, { name: "description", required: true, type: "string", description: "Explain your issue." }] },
  { command: "/support claim / awaiting-player / transfer / escalate / resolve / close / reopen / list / transcript", category: "support", permission: "Support Staff", summary: "Full support desk workflow: claim tickets, transfer staff, escalate to Head Managers, export .txt transcripts, and close.", example: "/support transcript ticket_id:<TICKET_ID>", params: [{ name: "ticket_id", required: true, type: "string", description: "MongoDB Ticket ID shown in the ticket channel." }] },
  { command: "/audit logs", category: "support", permission: "Manage Server", summary: "View recent immutable administrative audit records.", example: "/audit logs tournament_id:<ID> limit:15", params: [{ name: "tournament_id", required: false, type: "string", description: "Optional tournament filter.", autocomplete: true }, { name: "limit", required: false, type: "int (1–20)", description: "Number of recent entries." }] },
];

export const FAQ_ITEMS = [
  { q: "Why don't I see any commands except /activate after inviting the bot?", a: "SSE Tournament Bot uses per-server activation sync. Generate a single-use key for SSE Tournament Bot inside SSE Nexus and run /activate key:<KEY> as Server Owner or Administrator. All 55+ commands appear instantly after activation." },
  { q: "Why did the bot say 'manager actions are disabled for this tournament'?", a: "Built-in fair-play conflict-of-interest protection! If a manager or referee registers as a player in a tournament, they cannot approve squad power, generate matchmaking, review match proofs, or view other players' private match rooms in that specific tournament. Their Discord role is NOT stripped server-wide, and privileges automatically return if they /unregister." },
  { q: "What date format do /tournament configure, /match reschedule, and /availability set require?", a: "Timezone-aware ISO-8601 format. For Indian Standard Time (IST), append +05:30 — for example: 2026-12-10T19:30:00+05:30. For UTC, append Z (2026-12-10T14:00:00Z)." },
  { q: "How does Squad Power averaging work in /register?", a: "Players enter one or more non-negative numbers separated by commas (e.g., 3850,4100,3920) along with a screenshot. The bot computes the arithmetic mean and puts the submission in 'pending' state until a manager approves it via /squadpower review or this web dashboard." },
  { q: "What if a private match channel was accidentally deleted?", a: "Run /match repair-channel match_id:<ID>. The bot recreates the private channel with the exact participant and non-participating staff overwrites and reposts the match summary." },
  { q: "Does this website sync live with the Discord bot?", a: "Yes! SSE Tournament Web connects directly to the same MongoDB database as bot.py. Approving squad power, reviewing match proof, changing tournament status, adding brackets, or closing support tickets on the website immediately reflects in Discord and records an entry in audit_logs." },
];

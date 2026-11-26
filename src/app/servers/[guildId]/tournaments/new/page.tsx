"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Crown,
  FilePlus2,
  Gamepad2,
  Layers,
  MapPin,
  Plus,
  Rocket,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  DiscordChannelPicker,
  DiscordRoleMultiPicker,
  DiscordSingleRolePicker,
} from "@/components/DiscordRolePicker";
import { CustomSelect } from "@/components/CustomSelect";
import { ServerGuard } from "@/components/ServerGuard";
import { useWorkspace } from "@/components/WorkspaceContext";
import {
  TOURNAMENT_TEMPLATES,
  getTemplateById,
} from "@/lib/tournament-templates";
import {
  FORMAT_LABELS,
  SCORING_LABELS,
  type GameRow,
  type TeamPowerRule,
  type TournamentFormat,
  type TournamentMode,
  type TournamentScoring,
  type TournamentSummary,
  type TournamentTemplate,
} from "@/lib/tournament-types";

interface DraftBracket {
  key: string;
  name: string;
  minPower: string;
  maxPower: string;
}

const FORMAT_DETAILS: Array<{
  id: TournamentFormat;
  title: string;
  tagline: string;
}> = [
  { id: "single_elimination", title: "Single Elimination", tagline: "Classic knockout; 1 loss eliminates." },
  { id: "double_elimination", title: "Double Elimination", tagline: "Two losses to eliminate; auto lower rounds." },
  { id: "round_robin", title: "Round Robin", tagline: "Everyone plays everyone in a league rotation." },
  { id: "series", title: "Best-of Series", tagline: "Bo3/Bo5 head-to-head series with auto next game." },
  { id: "swiss", title: "Swiss System", tagline: "Score-matched rounds with no early elimination." },
  { id: "custom", title: "Custom Matches", tagline: "Manually schedule custom lobbies & rematches." },
];

const QUICK_MAP_PACKS: Record<string, string[]> = {
  "Mech Arena": ["Agora", "Skyship", "Forbidden City", "Canal", "Elon Station"],
  "Free Fire": ["Bermuda", "Purgatory", "Kalahari", "NeXTerra"],
  Minecraft: ["Netherite Arena", "Sword Kit", "Crystal Flat", "Axe & Shield"],
};

function checkBracketsOverlap(rows: DraftBracket[]): string | null {
  const parsed: Array<{ name: string; min: number; max: number | null }> = [];
  for (const r of rows) {
    const name = r.name.trim();
    if (!name) return "Every bracket needs a name.";
    const min = Number(r.minPower);
    if (r.minPower.trim() === "" || !Number.isFinite(min) || min < 0) {
      return `Bracket "${name}" needs a valid non-negative Min SP.`;
    }
    const max = r.maxPower.trim() === "" ? null : Number(r.maxPower);
    if (max !== null && (!Number.isFinite(max) || max < min)) {
      return `Bracket "${name}" Max SP must be >= Min SP (or leave blank for ∞).`;
    }
    for (const prev of parsed) {
      const aHi = max === null ? Number.POSITIVE_INFINITY : max;
      const bHi = prev.max === null ? Number.POSITIVE_INFINITY : prev.max;
      if (min <= bHi && prev.min <= aHi) {
        return `Bracket "${name}" overlaps with "${prev.name}". Adjust the SP boundaries.`;
      }
    }
    parsed.push({ name, min, max });
  }
  return null;
}

function WizardInner() {
  const params = useParams<{ guildId: string }>();
  const guildId = decodeURIComponent(params.guildId || "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { serverData, refreshServer } = useWorkspace();

  const initialTemplateParam = searchParams.get("template") || "";
  const initialGameParam = searchParams.get("gameId") || "";
  const initialCloneParam = searchParams.get("cloneFrom") || "";

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [games, setGames] = useState<GameRow[]>([]);
  const [existingTournaments, setExistingTournaments] = useState<TournamentSummary[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Quick-add game inline inside Step 2
  const [quickGameOpen, setQuickGameOpen] = useState(false);
  const [quickGameName, setQuickGameName] = useState("");
  const [addingGame, setAddingGame] = useState(false);

  // Wizard Form State
  const [templateId, setTemplateId] = useState<string>(
    initialTemplateParam || "blank"
  );
  const [clonedFromName, setClonedFromName] = useState<string | null>(null);
  const [cloneSelectId, setCloneSelectId] = useState<string>(initialCloneParam);

  // Step 2: Identity & Schedule
  const [name, setName] = useState("");
  const [gameId, setGameId] = useState(initialGameParam);
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [matchDurationMinutes, setMatchDurationMinutes] = useState(60);
  const [matchDeadlineHours, setMatchDeadlineHours] = useState(48);

  // Step 3: Format, Mode & SP Brackets
  const [format, setFormat] = useState<TournamentFormat>("single_elimination");
  const [mode, setMode] = useState<TournamentMode>("individual");
  const [scoring, setScoring] = useState<TournamentScoring>("wins");
  const [seriesBestOf, setSeriesBestOf] = useState(3);
  const [swissRounds, setSwissRounds] = useState(0);
  const [teamSizeMin, setTeamSizeMin] = useState(2);
  const [teamSizeMax, setTeamSizeMax] = useState(5);
  const [teamPowerRule, setTeamPowerRule] = useState<TeamPowerRule>("average");
  const [allowIncompleteTeams, setAllowIncompleteTeams] = useState(false);
  const [teamInvitesOnly, setTeamInvitesOnly] = useState(false);
  const [bracketsEnabled, setBracketsEnabled] = useState(false);
  const [brackets, setBrackets] = useState<DraftBracket[]>([]);

  // Step 4: Rules, Maps, Prizes & Discord Moderators
  const [proofRequired, setProofRequired] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [allowDraws, setAllowDraws] = useState(false);
  const [maps, setMaps] = useState<string[]>([]);
  const [mapInput, setMapInput] = useState("");
  const [firstPrize, setFirstPrize] = useState("");
  const [secondPrize, setSecondPrize] = useState("");
  const [thirdPrize, setThirdPrize] = useState("");
  const [managerRoleIds, setManagerRoleIds] = useState<string[]>([]);
  const [reviewerRoleIds, setReviewerRoleIds] = useState<string[]>([]);
  const [headManagerRoleIds, setHeadManagerRoleIds] = useState<string[]>([]);
  const [awardFirst, setAwardFirst] = useState("");
  const [awardSecond, setAwardSecond] = useState("");
  const [awardThird, setAwardThird] = useState("");
  const [announcementChannelId, setAnnouncementChannelId] = useState("");
  const [showAdvancedDiscord, setShowAdvancedDiscord] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializedDefaults, setInitializedDefaults] = useState(false);

  const settings = serverData?.settings;

  const applyTemplate = useCallback(
    (tpl: TournamentTemplate, loadedGames: GameRow[]) => {
      setTemplateId(tpl.id);
      setClonedFromName(null);
      setDescription(tpl.defaults.description);
      setFormat(tpl.defaults.format);
      setMode(tpl.defaults.mode);
      setScoring(tpl.defaults.scoring);
      setBracketsEnabled(tpl.defaults.bracketsEnabled);
      setBrackets(
        tpl.defaults.brackets.map((b, idx) => ({
          key: `tpl-${idx}-${Date.now()}`,
          name: b.name,
          minPower: String(b.minPower),
          maxPower: b.maxPower === null ? "" : String(b.maxPower),
        }))
      );
      setTeamSizeMin(tpl.defaults.teamSizeMin);
      setTeamSizeMax(tpl.defaults.teamSizeMax);
      setTeamPowerRule(tpl.defaults.teamPowerRule);
      setSeriesBestOf(tpl.defaults.seriesBestOf);
      setSwissRounds(tpl.defaults.swissRounds);
      setMaps([...tpl.defaults.maps]);
      setMatchDeadlineHours(tpl.defaults.matchDeadlineHours);
      setMatchDurationMinutes(tpl.defaults.matchDurationMinutes);
      setProofRequired(tpl.defaults.proofRequired);
      setApprovalRequired(tpl.defaults.approvalRequired);
      setAllowDraws(tpl.defaults.allowDraws);
      setTeamInvitesOnly(tpl.defaults.teamInvitesOnly);
      setFirstPrize(tpl.defaults.prizes.first);
      setSecondPrize(tpl.defaults.prizes.second);
      setThirdPrize(tpl.defaults.prizes.third);

      // Auto-match game if server has a matching game name
      if (tpl.gameHint && tpl.gameHint !== "Any Game" && loadedGames.length > 0) {
        const matched = loadedGames.find((g) =>
          g.name.toLowerCase().includes(tpl.gameHint.toLowerCase())
        );
        if (matched) setGameId(matched.id);
      }
    },
    []
  );

  const applyClonedTournament = useCallback((src: TournamentSummary) => {
    setTemplateId("clone");
    setClonedFromName(src.name);
    setName(`${src.name} (Season 2)`);
    if (src.gameId) setGameId(src.gameId);
    setDescription(src.description || "");
    setFormat(src.format);
    setMode(src.mode);
    setScoring(src.scoring);
    setSeriesBestOf(src.seriesBestOf || 3);
    setSwissRounds(src.swissRounds || 0);
    setTeamSizeMin(src.teamSizeMin || 2);
    setTeamSizeMax(src.teamSizeMax || 5);
    setTeamPowerRule(src.teamPowerRule || "average");
    setAllowIncompleteTeams(Boolean(src.allowIncompleteTeams));
    setTeamInvitesOnly(Boolean(src.teamInvitesOnly));
    setBracketsEnabled(Boolean(src.bracketsEnabled));
    setBrackets(
      (src.brackets || []).map((b, idx) => ({
        key: `clone-${idx}-${Date.now()}`,
        name: b.name,
        minPower: String(b.minPower),
        maxPower: b.maxPower === null ? "" : String(b.maxPower),
      }))
    );
    setMaps([...(src.maps || [])]);
    setMatchDeadlineHours(src.schedule.matchDeadlineHours || 48);
    setMatchDurationMinutes(src.schedule.matchDurationMinutes || 60);
    setProofRequired(src.resultPolicy.proofRequired);
    setApprovalRequired(src.resultPolicy.approvalRequired);
    setAllowDraws(src.resultPolicy.allowDraws);
    setFirstPrize(src.prizeDescriptions.first || "");
    setSecondPrize(src.prizeDescriptions.second || "");
    setThirdPrize(src.prizeDescriptions.third || "");
    setManagerRoleIds([...(src.managerRoleIds || [])]);
    setReviewerRoleIds([...(src.reviewerRoleIds || [])]);
    setHeadManagerRoleIds([...(src.headManagerRoleIds || [])]);
    setAwardFirst(src.awardRoleIds?.first || "");
    setAwardSecond(src.awardRoleIds?.second || "");
    setAwardThird(src.awardRoleIds?.third || "");
    setAnnouncementChannelId(src.announcementChannelId || "");
  }, []);

  // Load server games & existing tournaments for cloning
  const loadWizardData = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const [gRes, tRes] = await Promise.all([
        fetch(`/api/servers/${encodeURIComponent(guildId)}/games`, {
          cache: "no-store",
          credentials: "include",
        }),
        fetch(
          `/api/servers/${encodeURIComponent(guildId)}/tournaments?includeArchived=true`,
          { cache: "no-store", credentials: "include" }
        ),
      ]);
      const loadedGames: GameRow[] = gRes.ok
        ? (await gRes.json()).games || []
        : [];
      const loadedTourneys: TournamentSummary[] = tRes.ok
        ? (await tRes.json()).tournaments || []
        : [];

      setGames(loadedGames);
      setExistingTournaments(loadedTourneys);

      if (!initializedDefaults) {
        if (initialGameParam && loadedGames.some((g) => g.id === initialGameParam)) {
          setGameId(initialGameParam);
        } else if (loadedGames.length > 0) {
          setGameId((prev) => prev || loadedGames[0].id);
        }

        if (initialCloneParam) {
          const found = loadedTourneys.find((t) => t.id === initialCloneParam);
          if (found) {
            applyClonedTournament(found);
            setStep(2);
          }
        } else if (initialTemplateParam) {
          const tpl = getTemplateById(initialTemplateParam);
          applyTemplate(tpl, loadedGames);
          setStep(2);
        }
        setInitializedDefaults(true);
      }
    } finally {
      setLoadingMeta(false);
    }
  }, [
    guildId,
    initializedDefaults,
    initialGameParam,
    initialCloneParam,
    initialTemplateParam,
    applyClonedTournament,
    applyTemplate,
  ]);

  useEffect(() => {
    if (serverData?.access.isServerOwner) {
      loadWizardData();
    }
  }, [serverData?.access.isServerOwner, loadWizardData]);

  // Seed default moderator roles & announcement channel from server settings
  useEffect(() => {
    if (!settings) return;
    if (managerRoleIds.length === 0 && settings.defaultModeratorRoleIds.length > 0) {
      setManagerRoleIds(settings.defaultModeratorRoleIds);
    }
    if (!announcementChannelId && settings.announcementChannelId) {
      setAnnouncementChannelId(settings.announcementChannelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.guildId]);

  const bracketValidationError = useMemo(() => {
    if (!bracketsEnabled) return null;
    if (brackets.length === 0) return null; // optional to add later too
    return checkBracketsOverlap(brackets);
  }, [bracketsEnabled, brackets]);

  const formatDisallowsDraws = [
    "single_elimination",
    "double_elimination",
    "swiss",
    "series",
  ].includes(format);

  async function handleQuickAddGame() {
    const trimmed = quickGameName.trim();
    if (trimmed.length < 2) return;
    setAddingGame(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/servers/${encodeURIComponent(guildId)}/games`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not add game.");
        return;
      }
      setQuickGameName("");
      setQuickGameOpen(false);
      await loadWizardData();
      if (j.id) setGameId(j.id);
    } finally {
      setAddingGame(false);
    }
  }

  function addMapTag() {
    const pieces = mapInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (pieces.length === 0) return;
    setMaps((prev) => Array.from(new Set([...prev, ...pieces])).slice(0, 25));
    setMapInput("");
  }

  function validateStep(targetStep: number): string | null {
    if (targetStep >= 3) {
      if (name.trim().length < 2) {
        return "Enter a tournament name (at least 2 characters).";
      }
      if (!gameId) {
        return "Select a game (or add one using the Quick-Add button).";
      }
      if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
        return "Schedule end date must be after start date.";
      }
    }
    if (targetStep >= 4) {
      if (mode === "team" && teamSizeMin > teamSizeMax) {
        return "Minimum team size cannot exceed maximum team size.";
      }
      if (format === "series" && seriesBestOf % 2 === 0) {
        return "Best-of series must be an odd number (1, 3, 5, 7...).";
      }
      if (bracketValidationError) {
        return bracketValidationError;
      }
    }
    return null;
  }

  function goToStep(next: 1 | 2 | 3 | 4) {
    setError(null);
    if (next > step) {
      const err = validateStep(next);
      if (err) {
        setError(err);
        return;
      }
    }
    setStep(next);
  }

  async function handleLaunch() {
    const err = validateStep(4);
    if (err) {
      setError(err);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        gameId,
        description: description.trim(),
        templateId,
        format,
        mode,
        scoring,
        bracketsEnabled,
        brackets: bracketsEnabled
          ? brackets.map((b) => ({
              name: b.name.trim(),
              minPower: Number(b.minPower),
              maxPower: b.maxPower.trim() === "" ? null : Number(b.maxPower),
            }))
          : [],
        managerRoleIds,
        reviewerRoleIds,
        headManagerRoleIds,
        awardRoleIds: {
          first: awardFirst || undefined,
          second: awardSecond || undefined,
          third: awardThird || undefined,
        },
        announcementChannelId: announcementChannelId || null,
        teamSizeMin: mode === "team" ? teamSizeMin : 1,
        teamSizeMax: mode === "team" ? teamSizeMax : 1,
        teamPowerRule,
        allowIncompleteTeams,
        teamInvitesOnly,
        maps,
        seriesBestOf: format === "series" ? seriesBestOf : 3,
        swissRounds: format === "swiss" ? swissRounds : 0,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
        matchDeadlineHours,
        matchDurationMinutes,
        proofRequired,
        approvalRequired,
        allowDraws: formatDisallowsDraws ? false : allowDraws,
        prizes: {
          first: firstPrize.trim() || undefined,
          second: secondPrize.trim() || undefined,
          third: thirdPrize.trim() || undefined,
        },
      };

      const res = await fetch(
        `/api/servers/${encodeURIComponent(guildId)}/tournaments`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not create tournament.");
        return;
      }
      await refreshServer();
      router.push(`/servers/${guildId}/tournaments/${j.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedGameName =
    games.find((g) => g.id === gameId)?.name || "Not selected";

  const STEPS: Array<{ num: 1 | 2 | 3 | 4; label: string; icon: typeof Sparkles }> = [
    { num: 1, label: "Template", icon: Sparkles },
    { num: 2, label: "Identity", icon: Gamepad2 },
    { num: 3, label: "Format & Brackets", icon: Layers },
    { num: 4, label: "Rules & Mods", icon: ShieldCheck },
  ];

  return (
    <ServerGuard guildId={guildId} requireOwner>
      <div className="space-y-6">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href={`/servers/${guildId}/tournaments`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Server Tournaments
            </Link>
            <h1 className="mt-1.5 text-2xl font-black text-white sm:text-3xl">
              Create New Tournament
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Start from a battle-tested esports template, clone a past event,
              or build completely from blank.
            </p>
          </div>
          {clonedFromName && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/15 px-3 py-1 text-[11px] font-bold text-indigo-300">
              <Copy className="h-3 w-3" />
              Cloned from {clonedFromName}
            </span>
          )}
        </div>

        {/* 4-Step Visual Progress Stepper */}
        <div className="grid grid-cols-2 gap-2 rounded-3xl border border-slate-800 bg-slate-900/70 p-2 sm:grid-cols-4">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const active = step === s.num;
            const done = step > s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => goToStep(s.num)}
                className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left transition ${
                  active
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                    : done
                      ? "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
                      : "text-slate-400 hover:bg-slate-800/70 hover:text-white"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                    active
                      ? "bg-black/20"
                      : done
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : s.num}
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                    Step {s.num}
                  </div>
                  <div className="flex items-center gap-1 truncate text-xs font-extrabold">
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs font-semibold text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 1: TEMPLATE PICKER + BLANK + CLONE PREVIOUS                  */}
        {/* ================================================================= */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {TOURNAMENT_TEMPLATES.map((tpl) => {
                const selected = templateId === tpl.id && !clonedFromName;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      applyTemplate(tpl, games);
                      setStep(2);
                    }}
                    className={`group flex flex-col justify-between rounded-3xl border p-5 text-left transition ${
                      selected
                        ? "border-indigo-500 bg-indigo-500/15 shadow-lg"
                        : tpl.isBlank
                          ? "border-dashed border-slate-700 bg-slate-900/60 hover:border-indigo-500"
                          : "border-slate-800 bg-slate-900/70 hover:border-indigo-500/60 hover:shadow-lg"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold text-white"
                          style={{ backgroundColor: `${tpl.accent}33`, color: tpl.accent }}
                        >
                          {tpl.isBlank ? (
                            <FilePlus2 className="h-3 w-3" />
                          ) : (
                            <Sparkles className="h-3 w-3" />
                          )}
                          {tpl.gameHint}
                        </span>
                        {selected && (
                          <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                        )}
                      </div>

                      <h2 className="mt-3 text-sm font-extrabold text-white group-hover:text-indigo-300">
                        {tpl.name}
                      </h2>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                        {tpl.tagline}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-800/80 pt-3">
                      {tpl.isBlank ? (
                        <span className="text-[11px] font-bold text-indigo-400">
                          Configure every option manually →
                        </span>
                      ) : (
                        <>
                          <span className="rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                            {FORMAT_LABELS[tpl.defaults.format]}
                          </span>
                          <span className="rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-0.5 text-[10px] font-bold capitalize text-slate-300">
                            {tpl.defaults.mode === "team"
                              ? `${tpl.defaults.teamSizeMin}v${tpl.defaults.teamSizeMin} Teams`
                              : "Solo"}
                          </span>
                          {tpl.defaults.bracketsEnabled && (
                            <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              {tpl.defaults.brackets.length} SP Tiers
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Clone Previous Tournament Panel */}
            {existingTournaments.length > 0 && (
              <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
                      <Copy className="h-4 w-4 text-indigo-400" />
                      Clone a Previous Server Tournament
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Copy format, brackets, maps, prizes, and Moderator roles
                      into a fresh draft without copying old players or matches.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CustomSelect
                      className="min-w-[220px]"
                      value={cloneSelectId}
                      onChange={setCloneSelectId}
                      placeholder="Choose a tournament to clone..."
                      searchPlaceholder="Search tournaments..."
                      options={[
                        { value: "", label: "Choose a tournament to clone..." },
                        ...existingTournaments.map((t) => ({
                          value: t.id,
                          label: t.name,
                          badge: t.gameName,
                        })),
                      ]}
                    />
                    <button
                      type="button"
                      disabled={!cloneSelectId}
                      onClick={() => {
                        const found = existingTournaments.find(
                          (t) => t.id === cloneSelectId
                        );
                        if (found) {
                          applyClonedTournament(found);
                          setStep(2);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Clone &amp; Continue
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 2: IDENTITY & SCHEDULE                                       */}
        {/* ================================================================= */}
        {step === 2 && (
          <section className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-200">
                  Tournament Name *
                </label>
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. SSE Mech Arena Winter Cup"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200">
                    Game *
                  </label>
                  <button
                    type="button"
                    onClick={() => setQuickGameOpen((v) => !v)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Quick-add game
                  </button>
                </div>
                <CustomSelect
                  value={gameId}
                  onChange={setGameId}
                  disabled={loadingMeta}
                  placeholder="No games yet — click Quick-add game"
                  searchPlaceholder="Search games..."
                  options={
                    games.length === 0
                      ? [{ value: "", label: "No games yet — click Quick-add game" }]
                      : games.map((g) => ({ value: g.id, label: g.name }))
                  }
                />
              </div>
            </div>

            {quickGameOpen && (
              <div className="flex flex-col gap-2 rounded-2xl border border-indigo-500/35 bg-indigo-500/10 p-3.5 sm:flex-row sm:items-center">
                <input
                  value={quickGameName}
                  onChange={(e) => setQuickGameName(e.target.value)}
                  placeholder="New game name (e.g. Mech Arena, Free Fire, Minecraft)..."
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={addingGame || quickGameName.trim().length < 2}
                    onClick={handleQuickAddGame}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {addingGame ? "Adding..." : "Save Game"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickGameOpen(false)}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-200">
                Description &amp; Rules Summary
              </label>
              <textarea
                rows={4}
                maxLength={1500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain lobby rules, hangar limits, check-in timing, and screenshot proof requirements..."
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs leading-relaxed text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Schedule Window */}
            <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center gap-2 text-xs font-extrabold text-white">
                <Calendar className="h-4 w-4 text-indigo-400" />
                Schedule Window &amp; Match Timing (Optional)
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                    Start Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                    End Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                    Match Duration (mins)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={240}
                    value={matchDurationMinutes}
                    onChange={(e) =>
                      setMatchDurationMinutes(Number(e.target.value))
                    }
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                    Result Deadline (hours)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={matchDeadlineHours}
                    onChange={(e) =>
                      setMatchDeadlineHours(Number(e.target.value))
                    }
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ================================================================= */}
        {/* STEP 3: FORMAT, MODE, TEAMS & SP BRACKET BUILDER                  */}
        {/* ================================================================= */}
        {step === 3 && (
          <div className="space-y-5">
            {/* Format Cards */}
            <section className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Tournament Format
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {FORMAT_DETAILS.map((f) => {
                  const active = format === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFormat(f.id)}
                      className={`rounded-2xl border p-3.5 text-left transition ${
                        active
                          ? "border-indigo-500 bg-indigo-500/15"
                          : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-white">
                          {f.title}
                        </span>
                        {active && (
                          <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {f.tagline}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-200">
                    Scoring Model
                  </label>
                  <CustomSelect
                    value={scoring}
                    onChange={(val) => setScoring(val as TournamentScoring)}
                    searchable={false}
                    options={(Object.keys(SCORING_LABELS) as TournamentScoring[]).map(
                      (sc) => ({ value: sc, label: SCORING_LABELS[sc] })
                    )}
                  />
                </div>

                {format === "series" && (
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-200">
                      Best-Of Series (Odd)
                    </label>
                    <CustomSelect
                      value={String(seriesBestOf)}
                      onChange={(val) => setSeriesBestOf(Number(val))}
                      searchable={false}
                      options={[1, 3, 5, 7, 9].map((n) => ({
                        value: String(n),
                        label: `Best of ${n}`,
                        badge: `First to ${Math.floor(n / 2) + 1}`,
                      }))}
                    />
                  </div>
                )}

                {format === "swiss" && (
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-200">
                      Swiss Rounds (0 = Auto)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={swissRounds}
                      onChange={(e) => setSwissRounds(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Participant Mode & Team Settings */}
            <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Participant Mode
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode("individual")}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                    mode === "individual"
                      ? "border-indigo-500 bg-indigo-500/15"
                      : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
                    <Users className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xs font-extrabold text-white">
                      Individual / Solo (1v1)
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Players register and compete individually.
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("team")}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                    mode === "team"
                      ? "border-indigo-500 bg-indigo-500/15"
                      : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                    <Users className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xs font-extrabold text-white">
                      Team / Squad Rosters
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Captains create squads, invite members, and play together.
                    </div>
                  </div>
                </button>
              </div>

              {mode === "team" && (
                <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-300">
                        Min Team Size
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={teamSizeMin}
                        onChange={(e) => setTeamSizeMin(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-300">
                        Max Team Size (incl. subs)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={teamSizeMax}
                        onChange={(e) => setTeamSizeMax(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-300">
                        Team Power Calculation
                      </label>
                      <CustomSelect
                        value={teamPowerRule}
                        onChange={(val) => setTeamPowerRule(val as TeamPowerRule)}
                        searchable={false}
                        options={[
                          { value: "average", label: "Squad Average SP" },
                          { value: "all_members", label: "All Members Must Fit Tier" },
                          { value: "captain", label: "Captain's SP Only" },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={teamInvitesOnly}
                        onChange={(e) => setTeamInvitesOnly(e.target.checked)}
                        className="h-4 w-4 accent-indigo-500"
                      />
                      <span>
                        <strong className="block text-white">Invite-Only Teams</strong>
                        Players must be invited by the captain to join
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={allowIncompleteTeams}
                        onChange={(e) =>
                          setAllowIncompleteTeams(e.target.checked)
                        }
                        className="h-4 w-4 accent-indigo-500"
                      />
                      <span>
                        <strong className="block text-white">Allow Incomplete Teams</strong>
                        Include teams below min size in matchmaking
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </section>

            {/* Interactive Squad-Power Bracket Builder */}
            <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
                    <Layers className="h-4 w-4 text-amber-400" />
                    Squad-Power (SP) Brackets
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Divide players into fair power divisions (great for Mech
                    Arena). Leave OFF for open-bracket games like Minecraft.
                  </p>
                </div>

                <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white">
                  <input
                    type="checkbox"
                    checked={bracketsEnabled}
                    onChange={(e) => setBracketsEnabled(e.target.checked)}
                    className="h-4 w-4 accent-indigo-500"
                  />
                  Enable SP Brackets
                </label>
              </div>

              {bracketsEnabled && (
                <div className="space-y-3 border-t border-slate-800/80 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-400">
                      Define non-overlapping SP ranges (leave Max SP empty for ∞).
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setBrackets([
                            { key: `s1-${Date.now()}`, name: "Rookie", minPower: "0", maxPower: "2500" },
                            { key: `s2-${Date.now()}`, name: "Veteran", minPower: "2501", maxPower: "5000" },
                            { key: `s3-${Date.now()}`, name: "Legend", minPower: "5001", maxPower: "" },
                          ])
                        }
                        className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:border-indigo-500"
                      >
                        Load 3-Tier Starter
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setBrackets((prev) => [
                            ...prev,
                            {
                              key: `b-${Date.now()}-${prev.length}`,
                              name: `Tier ${prev.length + 1}`,
                              minPower:
                                prev.length > 0 && prev[prev.length - 1].maxPower
                                  ? String(Number(prev[prev.length - 1].maxPower) + 1)
                                  : "0",
                              maxPower: "",
                            },
                          ])
                        }
                        className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-500"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Bracket
                      </button>
                    </div>
                  </div>

                  {bracketValidationError && (
                    <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs font-semibold text-rose-300">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{bracketValidationError}</span>
                    </div>
                  )}

                  {brackets.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-5 text-center text-xs text-slate-400">
                      No brackets added yet. Add tiers now or configure them
                      later inside Moderators &amp; Settings.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {brackets.map((b, idx) => (
                        <div
                          key={b.key}
                          className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 sm:grid-cols-12 sm:items-center"
                        >
                          <div className="sm:col-span-5">
                            <input
                              value={b.name}
                              onChange={(e) =>
                                setBrackets((prev) =>
                                  prev.map((row, i) =>
                                    i === idx ? { ...row, name: e.target.value } : row
                                  )
                                )
                              }
                              placeholder="Bracket Name"
                              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <input
                              type="number"
                              min={0}
                              value={b.minPower}
                              onChange={(e) =>
                                setBrackets((prev) =>
                                  prev.map((row, i) =>
                                    i === idx
                                      ? { ...row, minPower: e.target.value }
                                      : row
                                  )
                                )
                              }
                              placeholder="Min SP"
                              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <input
                              type="number"
                              min={0}
                              value={b.maxPower}
                              onChange={(e) =>
                                setBrackets((prev) =>
                                  prev.map((row, i) =>
                                    i === idx
                                      ? { ...row, maxPower: e.target.value }
                                      : row
                                  )
                                )
                              }
                              placeholder="Max SP (∞)"
                              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                          <div className="flex justify-end sm:col-span-1">
                            <button
                              type="button"
                              onClick={() =>
                                setBrackets((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                              title="Remove bracket"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 4: RULES, MAPS, PRIZES, MODERATOR ROLES & SUMMARY            */}
        {/* ================================================================= */}
        {step === 4 && (
          <div className="space-y-5">
            {/* Result Policy & Map Rotation */}
            <section className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
                  <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
                  Result Verification &amp; Map Rotation
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex cursor-pointer items-center gap-2.5 rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={proofRequired}
                    onChange={(e) => setProofRequired(e.target.checked)}
                    className="h-4 w-4 accent-indigo-500"
                  />
                  <span>
                    <strong className="block text-white">Proof Required</strong>
                    Screenshot needed on /match submit
                  </span>
                </label>

                <label className="flex cursor-pointer items-center gap-2.5 rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={approvalRequired}
                    onChange={(e) => setApprovalRequired(e.target.checked)}
                    className="h-4 w-4 accent-indigo-500"
                  />
                  <span>
                    <strong className="block text-white">Staff Approval</strong>
                    Moderators verify before points apply
                  </span>
                </label>

                <label
                  className={`flex items-center gap-2.5 rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5 text-xs text-slate-300 ${
                    formatDisallowsDraws ? "opacity-50" : "cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={formatDisallowsDraws}
                    checked={!formatDisallowsDraws && allowDraws}
                    onChange={(e) => setAllowDraws(e.target.checked)}
                    className="h-4 w-4 accent-indigo-500"
                  />
                  <span>
                    <strong className="block text-white">Allow Draws</strong>
                    {formatDisallowsDraws
                      ? "Disabled for this format"
                      : "Awards +1 point on tied matches"}
                  </span>
                </label>
              </div>

              {/* Interactive Map Tags */}
              <div className="space-y-2.5 border-t border-slate-800/80 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                    Map Pool ({maps.length}/25)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(QUICK_MAP_PACKS).map((pack) => (
                      <button
                        key={pack}
                        type="button"
                        onClick={() =>
                          setMaps((prev) =>
                            Array.from(
                              new Set([...prev, ...QUICK_MAP_PACKS[pack]])
                            ).slice(0, 25)
                          )
                        }
                        className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-300 hover:border-indigo-500 hover:text-white"
                      >
                        + {pack} Maps
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    value={mapInput}
                    onChange={(e) => setMapInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addMapTag();
                      }
                    }}
                    placeholder="Type a map name and press Enter (or comma-separated)..."
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addMapTag}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:border-indigo-500"
                  >
                    Add
                  </button>
                </div>

                {maps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {maps.map((m) => (
                      <span
                        key={m}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[11px] font-bold text-slate-200"
                      >
                        {m}
                        <button
                          type="button"
                          onClick={() =>
                            setMaps((prev) => prev.filter((x) => x !== m))
                          }
                          className="text-slate-400 hover:text-rose-300"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Prizes */}
              <div className="space-y-2 border-t border-slate-800/80 pt-4">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <Crown className="h-3.5 w-3.5 text-amber-400" />
                  Podium Prizes (Shown on Winner Declaration)
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    value={firstPrize}
                    onChange={(e) => setFirstPrize(e.target.value)}
                    placeholder="1st Place Prize"
                    className="rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    value={secondPrize}
                    onChange={(e) => setSecondPrize(e.target.value)}
                    placeholder="2nd Place Prize"
                    className="rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    value={thirdPrize}
                    onChange={(e) => setThirdPrize(e.target.value)}
                    placeholder="3rd Place Prize"
                    className="rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Moderator Roles & Discord Settings */}
            <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Tournament Moderator Roles
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Select which Discord roles can log in here as Moderators to
                  verify squad power, review matches, and declare final winners.
                </p>
              </div>

              <DiscordRoleMultiPicker
                roles={settings?.discordRoles || []}
                selectedIds={managerRoleIds}
                onChange={setManagerRoleIds}
                label="Assigned Moderator Roles"
                hint="Pre-filled from your Server Settings default moderator roles."
              />

              <button
                type="button"
                onClick={() => setShowAdvancedDiscord((v) => !v)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-xs font-bold text-slate-300 hover:border-indigo-500/50 hover:text-white"
              >
                <span>
                  Advanced Discord Roles (Reviewers, Award Roles &amp; Announcement Channel)
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    showAdvancedDiscord ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showAdvancedDiscord && (
                <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DiscordRoleMultiPicker
                      roles={settings?.discordRoles || []}
                      selectedIds={reviewerRoleIds}
                      onChange={setReviewerRoleIds}
                      label="Match Reviewer Roles (Optional)"
                    />
                    <DiscordRoleMultiPicker
                      roles={settings?.discordRoles || []}
                      selectedIds={headManagerRoleIds}
                      onChange={setHeadManagerRoleIds}
                      label="Head Manager Roles (Escalations)"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 border-t border-slate-800/80 pt-4 sm:grid-cols-3">
                    <DiscordSingleRolePicker
                      roles={settings?.discordRoles || []}
                      value={awardFirst}
                      onChange={setAwardFirst}
                      label="1st Place Award Role"
                    />
                    <DiscordSingleRolePicker
                      roles={settings?.discordRoles || []}
                      value={awardSecond}
                      onChange={setAwardSecond}
                      label="2nd Place Award Role"
                    />
                    <DiscordSingleRolePicker
                      roles={settings?.discordRoles || []}
                      value={awardThird}
                      onChange={setAwardThird}
                      label="3rd Place Award Role"
                    />
                  </div>

                  <div className="border-t border-slate-800/80 pt-4">
                    <DiscordChannelPicker
                      channels={settings?.discordChannels || []}
                      value={announcementChannelId}
                      onChange={setAnnouncementChannelId}
                      label="Tournament Announcement Channel"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Launch Summary Preview */}
            <section className="rounded-3xl border border-indigo-500/35 bg-indigo-500/10 p-5">
              <div className="text-xs font-extrabold uppercase tracking-wider text-indigo-300">
                Ready to Launch Summary
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div>
                  <span className="block text-[10px] text-slate-400">Tournament</span>
                  <strong className="text-white">{name || "Untitled"}</strong>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400">Game</span>
                  <strong className="text-white">{selectedGameName}</strong>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400">Format &amp; Mode</span>
                  <strong className="text-white">
                    {FORMAT_LABELS[format]} · {mode === "team" ? `Teams ${teamSizeMin}–${teamSizeMax}` : "Solo"}
                  </strong>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400">SP Brackets / Mods</span>
                  <strong className="text-white">
                    {bracketsEnabled ? `${brackets.length} tiers` : "Off"} ·{" "}
                    {managerRoleIds.length} mod role(s)
                  </strong>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Wizard Footer Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-4">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => goToStep((step - 1) as 1 | 2 | 3 | 4)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-200 hover:border-indigo-500 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous Step
              </button>
            ) : (
              <Link
                href={`/servers/${guildId}/tournaments`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white"
              >
                Cancel
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <button
                type="button"
                onClick={() => goToStep((step + 1) as 1 | 2 | 3 | 4)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleLaunch}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-lg transition hover:bg-emerald-500 disabled:opacity-50"
              >
                <Rocket className="h-4 w-4" />
                {submitting ? "Creating Tournament..." : "Create Draft Tournament"}
              </button>
            )}
          </div>
        </div>
      </div>
    </ServerGuard>
  );
}

export default function NewTournamentWizardPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 py-6">
          <div className="h-16 animate-pulse rounded-3xl bg-slate-900/70" />
          <div className="h-72 animate-pulse rounded-3xl bg-slate-900/60" />
        </div>
      }
    >
      <WizardInner />
    </Suspense>
  );
}

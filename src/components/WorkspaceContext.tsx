"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import type {
  GuildChannelInfo,
  GuildRoleInfo,
  ServerAccessContext,
  ServerSettingsData,
  TournamentAccessContext,
  TournamentSummary,
} from "@/lib/tournament-types";

export type WorkspaceLevel = "main" | "server" | "tournament";

export interface ServerWorkspaceData {
  access: ServerAccessContext;
  settings: ServerSettingsData;
  stats: {
    totalTournaments: number;
    liveTournaments: number;
    openTournaments: number;
    totalGames: number;
    totalRegistrations: number;
    pendingPower: number;
    pendingMatches: number;
    openTickets: number;
    memberCount: number;
  };
  recentTournaments: TournamentSummary[];
}

export interface TournamentWorkspaceMeta {
  tournament: TournamentSummary;
  access: TournamentAccessContext;
  discordRoles: GuildRoleInfo[];
  discordChannels: GuildChannelInfo[];
}

interface WorkspaceContextValue {
  level: WorkspaceLevel;
  guildId: string | null;
  tournamentId: string | null;
  serverData: ServerWorkspaceData | null;
  serverLoading: boolean;
  serverError: string | null;
  tournamentMeta: TournamentWorkspaceMeta | null;
  tournamentLoading: boolean;
  refreshServer: () => Promise<void>;
  refreshTournament: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function parseWorkspacePath(pathname: string): {
  level: WorkspaceLevel;
  guildId: string | null;
  tournamentId: string | null;
} {
  const tourneyMatch = pathname.match(/^\/servers\/([^/]+)\/tournaments\/([^/]+)/);
  if (tourneyMatch && tourneyMatch[2] !== "new") {
    return {
      level: "tournament",
      guildId: decodeURIComponent(tourneyMatch[1]),
      tournamentId: decodeURIComponent(tourneyMatch[2]),
    };
  }
  const serverMatch = pathname.match(/^\/servers\/([^/]+)/);
  if (serverMatch) {
    return {
      level: "server",
      guildId: decodeURIComponent(serverMatch[1]),
      tournamentId: null,
    };
  }
  return { level: "main", guildId: null, tournamentId: null };
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();

  const { level, guildId, tournamentId } = useMemo(
    () => parseWorkspacePath(pathname),
    [pathname]
  );

  const [serverData, setServerData] = useState<ServerWorkspaceData | null>(null);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [tournamentMeta, setTournamentMeta] =
    useState<TournamentWorkspaceMeta | null>(null);
  const [tournamentLoading, setTournamentLoading] = useState(false);

  const refreshServer = useCallback(async () => {
    if (!guildId || !user) {
      setServerData(null);
      setServerError(null);
      return;
    }
    setServerLoading(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(guildId)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setServerData(null);
        setServerError(data?.error || "Could not load server workspace.");
        return;
      }
      setServerData(data as ServerWorkspaceData);
    } catch {
      setServerError("Network error while loading server workspace.");
    } finally {
      setServerLoading(false);
    }
  }, [guildId, user]);

  const refreshTournament = useCallback(async () => {
    if (!tournamentId) {
      setTournamentMeta(null);
      return;
    }
    setTournamentLoading(true);
    try {
      const res = await fetch(
        `/api/tournaments/${encodeURIComponent(tournamentId)}`,
        { cache: "no-store", credentials: "include" }
      );
      if (!res.ok) {
        setTournamentMeta(null);
        return;
      }
      const data = await res.json();
      if (data?.tournament && data?.access) {
        setTournamentMeta({
          tournament: data.tournament,
          access: data.access,
          discordRoles: data.discordRoles || [],
          discordChannels: data.discordChannels || [],
        });
      }
    } catch {
      // ignore transient errors
    } finally {
      setTournamentLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (authLoading) return;
    if (guildId) {
      if (serverData?.settings.guildId !== guildId) {
        setServerData(null);
      }
      refreshServer();
    } else {
      setServerData(null);
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, authLoading, user?.sub]);

  useEffect(() => {
    if (authLoading) return;
    if (tournamentId) {
      if (tournamentMeta?.tournament.id !== tournamentId) {
        setTournamentMeta(null);
      }
      refreshTournament();
    } else {
      setTournamentMeta(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, authLoading, user?.sub]);

  return (
    <WorkspaceContext.Provider
      value={{
        level,
        guildId,
        tournamentId,
        serverData,
        serverLoading,
        serverError,
        tournamentMeta,
        tournamentLoading,
        refreshServer,
        refreshTournament,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  }
  return ctx;
}

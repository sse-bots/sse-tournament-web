"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { SessionActor } from "@/lib/types";

type Theme = "dark" | "light";

interface ArenaContextValue {
  theme: Theme;
  toggleTheme: () => void;
  actor: SessionActor | null;
  loadingActor: boolean;
  refreshActor: () => Promise<void>;
  activeGuildId: string;
  setActiveGuildId: (id: string) => void;
  guilds: Array<{ guildId: string }>;
}

const ArenaContext = createContext<ArenaContextValue>({
  theme: "dark",
  toggleTheme: () => {},
  actor: null,
  loadingActor: true,
  refreshActor: async () => {},
  activeGuildId: "",
  setActiveGuildId: () => {},
  guilds: [],
});

export function useArena() {
  return useContext(ArenaContext);
}

export function ArenaProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [actor, setActor] = useState<SessionActor | null>(null);
  const [loadingActor, setLoadingActor] = useState(true);
  const [activeGuildId, setActiveGuildIdState] = useState("");
  const [guilds, setGuilds] = useState<Array<{ guildId: string }>>([]);

  useEffect(() => {
    const stored = (localStorage.getItem("sse-arena-theme") as Theme | null) || "dark";
    setTheme(stored);
    document.documentElement.classList.toggle("dark", stored === "dark");

    const storedGuild = localStorage.getItem("sse-arena-guild") || "";
    if (storedGuild) setActiveGuildIdState(storedGuild);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      localStorage.setItem("sse-arena-theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }, []);

  const setActiveGuildId = useCallback((id: string) => {
    setActiveGuildIdState(id);
    if (id) localStorage.setItem("sse-arena-guild", id);
    else localStorage.removeItem("sse-arena-guild");
  }, []);

  const refreshActor = useCallback(async () => {
    setLoadingActor(true);
    try {
      const [meRes, gRes] = await Promise.all([
        fetch(`/api/me${activeGuildId ? `?guildId=${encodeURIComponent(activeGuildId)}` : ""}`),
        fetch("/api/guilds"),
      ]);
      if (meRes.ok) {
        const data = await meRes.json();
        setActor(data.actor || null);
      }
      if (gRes.ok) {
        const gData = await gRes.json();
        setGuilds(gData.guilds || []);
        if (!activeGuildId && gData.defaultGuildId) {
          setActiveGuildIdState(gData.defaultGuildId);
        }
      }
    } catch {
      // ignore offline error
    } finally {
      setLoadingActor(false);
    }
  }, [activeGuildId]);

  useEffect(() => {
    refreshActor();
  }, [refreshActor]);

  return (
    <ArenaContext.Provider
      value={{
        theme,
        toggleTheme,
        actor,
        loadingActor,
        refreshActor,
        activeGuildId,
        setActiveGuildId,
        guilds,
      }}
    >
      {children}
    </ArenaContext.Provider>
  );
}

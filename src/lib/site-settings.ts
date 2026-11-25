import type { ColorMode } from "./theme-config";

export const SITE_SETTINGS = {
  siteName: "SSE Tournaments",
  shortName: "SSE",
  brandPrefix: "SSE",
  organizationName: "SSE World",
  tagline: "Esports Arena & Bot Control Hub",
  description:
    "Host, manage, and spectate competitive Mech Arena, Free Fire, and Minecraft tournaments powered by SSE Tournament Bot, squad-power brackets, proof verification, and SSE Accounts SSO.",
  supportEmail: "support@sse-world.local",

  links: {
    accountsUrl:
      process.env.NEXT_PUBLIC_SSE_ACCOUNTS_URL || "https://sse-account.vercel.app",
    nexusUrl:
      process.env.NEXT_PUBLIC_NEXUS_URL || "https://sse-nexus.vercel.app",
    botInviteUrl: process.env.NEXT_PUBLIC_BOT_INVITE_URL || "",
    supportServerInvite: process.env.NEXT_PUBLIC_SUPPORT_SERVER_INVITE || "",
    githubOrgUrl: "https://github.com/sse-bots",
  },

  defaultTheme: {
    preset: "default",
    primary: "emerald",
    neutral: "slate",
    font: "public-sans",
    radius: "0.5rem",
    mode: "dark" as ColorMode,
  },

  featuredGames: [
    {
      name: "Mech Arena",
      badge: "SP Brackets",
      format: "Best-of-3 / Double Elim",
      description:
        "Average hangar Squad Power verification, XP/SP brackets, private match rooms, and A-Coins / Credits prize pools.",
    },
    {
      name: "Free Fire",
      badge: "Squads & Points",
      format: "Points / Round Robin",
      description:
        "Captain-led squads, invite-only rosters, screenshot proof review, custom map rotations, and live points leaderboards.",
    },
    {
      name: "Minecraft",
      badge: "1v1 & Team PvP",
      format: "Swiss / Single Elim",
      description:
        "Fast bracket progression, automatic byes, participant availability windows, and instant CSV results export.",
    },
  ],
};

export type SiteSettings = typeof SITE_SETTINGS;

# SSE Tournament Web v3.0 — Multi-Server Esports Manager

Multi-server esports tournament creation, management, result declaration, and Discord bot documentation hub for **SSE Tournament Bot** (`bot-v3.py`), authenticated via **SSE Accounts SSO**.

## Architecture & Key Features
- **3-Level Contextual Sidebar:**
  - **Main Menu (`/`, `/servers`, `/docs`):** Clean global navigation (Arena Home, Servers, Bot Docs) without cluttering Games or Tournaments in the global bar.
  - **Server Workspace (`/servers/[guildId]/...`):** Displays `← Back to Main Menu`, live Bot Online heartbeat, role badge (`Server Owner`, `Moderator`, or `Member`), Server Overview, Games, Tournaments, Support Tickets, Server Settings, and Audit Logs.
  - **Tournament Workspace (`/servers/[guildId]/tournaments/[id]/...`):** Displays `← Server` & `Main Menu` navigation, Overview & Rules, Matches & Brackets, Standings & Result Declaration Studio, Players & Power Queue, Teams & Rosters, Moderators & Settings, and Activity Log.
- **Role-Based Access Control (RBAC):**
  - **Server Owner only:** Create tournaments (from templates, clone, or blank), manage server games, configure server settings, assign/remove Tournament Moderator Discord roles, and delete tournaments.
  - **Assigned Moderators:** Unlock full tournament admin controls (Squad Power verification, match review/forfeit/override, matchmaking trigger, announcements, result declaration, support tickets, and audit logs) when signed in with SSE Accounts.
  - **Fair-Play Lock:** Automatically locks staff tools inside a tournament if that moderator is registered as a participant.
  - **Server Members:** Browse server games, tournaments, brackets, teams, standings, and view a personalized status card.
- **Templates + Blank Builder:** 6 esports presets (Mech Arena Bo3 & Double Elim, Free Fire Squad League & Custom Room, Minecraft PvP Swiss, Weekend Speed Cup), Blank Tournament, and Clone Previous Tournament.
- **Real-Time Two-Way WebSync (`bot-v3.py`):** Syncs Discord roles, channels, moderator roleMembers, web-triggered matchmaking, Discord announcements, custom match rooms, ticket updates, and official winner announcements + award role grants.

## Deployment
1. Register an OAuth 2.1 app in **SSE Accounts Admin → OAuth / SSO Apps** with Redirect URI `https://<your-domain>/api/auth/callback` (enable **Skip Consent** for 1st-party SSO).
2. Configure environment variables from `.env.example` in Vercel Project Settings pointing to the same MongoDB database as `bot-v3.py`.
3. Deploy `bot-v3.py` on Render with `WEB_DASHBOARD_URL` set to your Vercel URL.

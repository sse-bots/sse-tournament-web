# SSE Tournament Web

Official esports tournament hub, live bracket & standings viewer, web management dashboard, and interactive Discord Bot documentation for **SSE Tournament Bot** (`bot.py`).

## Features
- **SSE Accounts SSO (OAuth 2.1 + PKCE):** Centralized sign-in via `https://sse-account.vercel.app` with Discord server bridging (`sse:servers`), roles (`sse:roles`), and verified identity badges.
- **Direct MongoDB Sync with `bot.py`:** Reads and writes the exact `games`, `tournaments`, `registrations`, `teams`, `matches`, `support_tickets`, `audit_logs`, `guild_config`, `series_records`, and `availability` collections.
- **Esports Tournament Hub (`/tournaments`, `/tournaments/[id]`):** Live round-by-round brackets, squad-power brackets, podium standings, proof screenshot lightbox, and 1-click CSV export.
- **Manager Control Center (`/dashboard`, `/dashboard/tournaments/[id]`):** Manage servers, games, tournaments, lifecycle transitions, squad-power proof approvals, match reviews/forfeits/overrides, support tickets, and audit logs.
- **Interactive Bot Docs (`/docs`):** Searchable command catalog for every command in `bot.py`, quickstart setup guide, formats & scoring matrix, game playbooks (Mech Arena, Free Fire, Minecraft), and fair-play FAQ.

## Deployment
1. Register an OAuth client in **SSE Accounts Admin → OAuth / SSO Apps** with Redirect URI `https://<your-domain>/api/auth/callback`.
2. Add environment variables from `.env.example` in Vercel Project Settings.
3. Deploy `main` branch on Vercel.
